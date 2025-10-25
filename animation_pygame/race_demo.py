import math
import pygame

# -------------------- BASIC PARAMETERS --------------------
W, H = 960, 360
FPS = 60
FIXED_DT = 1 / 60

BG_PATH = "background.png"
SPRITE_SHEET = "horse_run_rembg.png"
FRAME_COUNT = 12
ANIM_FPS = 10

# Background split positions (for debug)
FENCE_TOP_Y = 270
GROUND_TOP_Y = 445

# Parallax & placement
FAR_TARGET_H = 180
FAR_Y = 60
FAR_SPEED = 40
NEAR_TARGET_H = 140
NEAR_SPEED = 110

# -------------------- COUNTDOWN --------------------
COUNTDOWN_SECONDS = 10
COUNTDOWN_COLOR = (255, 60, 60)

# -------------------- FINISH LINE --------------------
USE_FINISH_LINE = True
FINISH_DELAY_S = 2.5
FINISH_COLOR = (220, 40, 40)
FINISH_WIDTH_PX = 6
FINISH_DIRECTION = 'left'  # 'left' → moves right→left; 'right' → left→right
FINISH_SPEED_MODE = 'fixed'  # 'fixed' | 'scale' | 'follow'
FINISH_SPEED_FIXED = 180
FINISH_SPEED_SCALE = 1.2

# -------------------- START & TRACK --------------------
START_X = 60
GROUND_OVERLAP = 4


# -------------------- UTILITY FUNCTIONS --------------------
def load_strip_row(path, frame_count, scale=1.0):
    sheet = pygame.image.load(path).convert_alpha()
    sw, sh = sheet.get_width(), sheet.get_height()
    fw = sw // frame_count
    frames = []
    for i in range(frame_count):
        rect = pygame.Rect(i * fw, 0, fw, sh)
        frame = sheet.subsurface(rect).copy()
        if scale != 1.0:
            frame = pygame.transform.smoothscale(frame, (int(fw * scale), int(sh * scale)))
        frames.append(frame)
    return frames


def crop(surface, rect):
    x, y, w, h = rect
    sub = pygame.Surface((w, h), pygame.SRCALPHA)
    sub.blit(surface, (0, 0), area=rect)
    return sub


# -------------------- INFINITE TILED LAYER --------------------
class TiledLayer:
    def __init__(self, surf, speed_px_s, y, direction='right', scale_to_height=None):
        self.dir = 1 if direction == 'right' else -1
        if scale_to_height:
            h = scale_to_height
            w = int(surf.get_width() * (h / surf.get_height()))
            surf = pygame.transform.smoothscale(surf, (w, h))
        self.tex = surf.convert_alpha()
        self.w = self.tex.get_width()
        self.h = self.tex.get_height()
        self.y = y
        self.speed = speed_px_s
        self.offset = 0.0

    def update(self, dt):
        self.offset = (self.offset + self.dir * self.speed * dt) % self.w

    def draw(self, screen):
        start_x = -int(self.offset)
        x = start_x
        while x < W:
            screen.blit(self.tex, (x, self.y))
            x += self.w


# -------------------- HORSE SPRITE --------------------
class HorseSprite:
    """
    vx: current horizontal velocity (>0 means rightward)
    target_vx: target velocity
    accel: acceleration per second (toward target_vx)
    plan: [{'t': time_s, 'target_vx': value, 'accel': value}, ...]
    """
    def __init__(self, x, lane_y, frames, fps_anim=12,
                 anchor=(0.50, 0.88), bob_amp=6,
                 vx=0.0, target_vx=0.0, accel=0.0, plan=None, anim_rate=1.0):
        self.x = x
        self.lane_y = lane_y
        self.frames = frames
        self.fps_anim = fps_anim * anim_rate
        self.idx = 0
        self.acc_anim = 0.0
        self.anchor = anchor
        self.t = 0.0
        self.bob_amp = bob_amp

        self.vx = vx
        self.target_vx = target_vx
        self.accel = accel
        self.plan = sorted(plan or [], key=lambda s: s['t'])
        self.step_idx = 0

    def apply_plan_until(self, t_global):
        while self.step_idx < len(self.plan) and t_global >= self.plan[self.step_idx]['t']:
            step = self.plan[self.step_idx]
            self.target_vx = float(step.get('target_vx', self.target_vx))
            self.accel = float(step.get('accel', self.accel))
            self.step_idx += 1

    def update(self, dt, position_enabled=True):
        # Always animate frames; if you want still horses during countdown,
        # move this inside the "if position_enabled" block.
        self.acc_anim += dt
        step = 1.0 / self.fps_anim
        while self.acc_anim >= step:
            self.idx = (self.idx + 1) % len(self.frames)
            self.acc_anim -= step
        self.t += dt

        if not position_enabled:
            return

        if self.accel > 0:
            if self.vx < self.target_vx:
                self.vx = min(self.target_vx, self.vx + self.accel * dt)
            elif self.vx > self.target_vx:
                self.vx = max(self.target_vx, self.vx - self.accel * dt)
        self.x += self.vx * dt

    def draw(self, screen):
        img = self.frames[self.idx]
        w, h = img.get_width(), img.get_height()
        bob = int(math.sin(self.t * 10.0) * self.bob_amp)
        draw_x = int(self.x - self.anchor[0] * w)
        draw_y = int(self.lane_y - self.anchor[1] * h + bob)
        screen.blit(img, (draw_x, draw_y))


# -------------------- FINISH LINE (bidirectional + 3 speed modes) --------------------
class FinishLine:
    def __init__(self, near_layer, delay_s, color, width_px, direction='right',
                 mode='fixed', speed_px_s=180, speed_scale=1.0):
        self.near = near_layer
        self.delay = delay_s
        self.color = color
        self.width = width_px
        self.dir = 1 if direction == 'right' else -1
        self.mode = mode
        self.speed = float(speed_px_s)
        self.speed_scale = float(speed_scale)
        self.active = False
        self.x = 0.0
        self.t = 0.0
        self.start_left = -120
        self.start_right = W + 120

    def reset_timer(self):
        self.t = 0.0
        self.active = False

    def update(self, dt, time_enabled=True):
        if time_enabled:
            self.t += dt
        if not self.active and self.t >= self.delay:
            self.active = True
            self.x = self.start_left if self.dir == 1 else self.start_right
        if self.active:
            if self.mode == 'fixed':
                v = self.speed
            elif self.mode == 'scale':
                v = self.near.speed * self.speed_scale
            else:
                v = self.near.speed
            self.x += self.dir * v * dt

    def draw(self, screen):
        if not self.active:
            return
        rect = pygame.Rect(int(self.x), self.near.y, self.width, self.near.h)
        pygame.draw.rect(screen, self.color, rect)


# -------------------- MAIN PROGRAM --------------------
def main():
    pygame.init()
    screen = pygame.display.set_mode((W, H))
    pygame.display.set_caption("Horse Racing - countdown + proper stop on finish")
    clock = pygame.time.Clock()

    font_big = pygame.font.SysFont(None, 120)
    font_small = pygame.font.SysFont(None, 22)

    # Background layers
    bg_full = pygame.image.load(BG_PATH).convert_alpha()
    bw, bh = bg_full.get_width(), bg_full.get_height()
    far_region = crop(bg_full, (0, 0, bw, GROUND_TOP_Y))
    near_region = crop(bg_full, (0, GROUND_TOP_Y, bw, bh - GROUND_TOP_Y))

    far = TiledLayer(far_region, speed_px_s=FAR_SPEED, y=FAR_Y,
                     direction='right', scale_to_height=FAR_TARGET_H)
    near = TiledLayer(near_region, speed_px_s=NEAR_SPEED, y=0,
                      direction='right', scale_to_height=NEAR_TARGET_H)
    near.y = H - near.h

    # Horses and track
    frames = load_strip_row(SPRITE_SHEET, FRAME_COUNT, scale=0.9)
    near_top = near.y
    lanes = [near_top + (GROUND_OVERLAP + d) for d in (0, 10, 20)]

    # Movement plans (sample)
    plans = [
        [{'t': 0.8, 'target_vx': 80, 'accel': 60},
         {'t': 3.0, 'target_vx': 20, 'accel': 50}],
        [{'t': 1.0, 'target_vx': 110, 'accel': 80},
         {'t': 2.5, 'target_vx': 160, 'accel': 120},
         {'t': 4.0, 'target_vx': 60, 'accel': 100}],
        [{'t': 1.4, 'target_vx': 90, 'accel': 70},
         {'t': 3.2, 'target_vx': 120, 'accel': 90}],
    ]

    horses = [
        HorseSprite(START_X, lanes[0], frames, fps_anim=ANIM_FPS, anchor=(0.50, 0.88),
                    bob_amp=6, vx=0.0, target_vx=0.0, accel=0.0, plan=plans[0], anim_rate=1.4),
        HorseSprite(START_X, lanes[1], frames, fps_anim=ANIM_FPS, anchor=(0.50, 0.88),
                    bob_amp=6, vx=0.0, target_vx=0.0, accel=0.0, plan=plans[1], anim_rate=1.3),
        HorseSprite(START_X, lanes[2], frames, fps_anim=ANIM_FPS, anchor=(0.50, 0.88),
                    bob_amp=6, vx=0.0, target_vx=0.0, accel=0.0, plan=plans[2], anim_rate=1.5),
    ]

    # Finish line
    if USE_FINISH_LINE:
        finish = FinishLine(
            near_layer=near,
            delay_s=FINISH_DELAY_S,
            color=FINISH_COLOR,
            width_px=FINISH_WIDTH_PX,
            direction=FINISH_DIRECTION,
            mode=FINISH_SPEED_MODE,
            speed_px_s=FINISH_SPEED_FIXED,
            speed_scale=FINISH_SPEED_SCALE
        )
        passed = [False] * len(horses)
    else:
        finish, passed = None, None

    # State machine
    STATE_COUNTDOWN = 0
    STATE_RUNNING = 1
    state = STATE_COUNTDOWN
    countdown_t = 0.0
    t_global = 0.0

    acc = 0.0
    prev = pygame.time.get_ticks() / 1000.0
    running = True
    while running:
        now = pygame.time.get_ticks() / 1000.0
        acc += (now - prev)
        prev = now

        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                running = False
            if e.type == pygame.KEYDOWN and e.key == pygame.K_ESCAPE:
                running = False

        while acc >= FIXED_DT:
            if state == STATE_COUNTDOWN:
                # Only advance countdown timer; do not update layers/horses/finish line
                countdown_t += FIXED_DT

                # When countdown ends -> start race
                if countdown_t >= COUNTDOWN_SECONDS:
                    state = STATE_RUNNING
                    t_global = 0.0
                    if USE_FINISH_LINE:
                        finish.reset_timer()

            else:
                # ===== Normal race logic =====
                t_global += FIXED_DT
                far.update(FIXED_DT)
                near.update(FIXED_DT)

                for h in horses:
                    h.apply_plan_until(t_global)
                    h.update(FIXED_DT, position_enabled=True)

                if USE_FINISH_LINE:
                    finish.update(FIXED_DT, time_enabled=True)
                    if finish.active:
                        s = 1 if FINISH_DIRECTION == 'right' else -1
                        front = (finish.x + FINISH_WIDTH_PX) if finish.dir == 1 else finish.x
                        for i, h in enumerate(horses):
                            if not passed[i] and (s * front) >= (s * h.x):
                                passed[i] = True
                        if all(passed):
                            running = False
            acc -= FIXED_DT

        # Render: background → ground → finish line → horses → track lines
        screen.fill((170, 220, 255))
        far.draw(screen)
        near.draw(screen)
        if USE_FINISH_LINE:
            finish.draw(screen)
        for h in sorted(horses, key=lambda o: o.lane_y):
            h.draw(screen)
        near_top = near.y
        for y in [near_top + d for d in (35, 65, 95)]:
            pygame.draw.line(screen, (120, 80, 50), (0, y), (W, y), 2)

        # Countdown UI
        if state == STATE_COUNTDOWN:
            remain = max(0, COUNTDOWN_SECONDS - countdown_t)
            show_num = max(1, int(math.ceil(remain)))
            text = font_big.render(str(show_num), True, COUNTDOWN_COLOR)
            screen.blit(text, (W // 2 - text.get_width() // 2, H // 2 - text.get_height() // 2))
            tip = font_small.render("", True, (0, 0, 0))
            screen.blit(tip, (W // 2 - tip.get_width() // 2, H // 2 + text.get_height() // 2 + 8))

        pygame.display.flip()
        clock.tick(FPS)

    pygame.quit()


if __name__ == "__main__":
    main()
