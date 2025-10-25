# farcaster #
Develop tools and application testing for UNLV capstone

## Ubuntu: ##
1. Install nodejs and npm:

    ```sudo apt install nodejs npm```


2. Install the farcaster stuff:

    ```npm install @farcaster/miniapp-wagmi-connector```

    ```npm install @farcaster/frame-sdk```


3. Clone the repo and cd into it:

    ```git clone <link>```

    ```cd farcaster```


4. Run npm install:

    ```npm install --include=dev```

5. Setup python venv
    ```python -m venv venv``` or ```python3 -m venv venv```

6. Install python requirements.txt
    - ```source venv/bin/activate```
    - ```pip install -r requirements.txt```

7. Run the dev server:

    ```npm run dev```

---------------------------------------------------------------------
IF YOU GET AN ERROR, run these commands, then run npm install again:

```unset ESBUILD_BINARY_PATH```

```rm -rf node_modules package-lock.json```

```npm cache clear --force```

```npm install```

--------------------------------------------------------------------

## Using localhost for development: ##

1. Install cloudflared:

    ```brew install cloudflared```


2. Expose localhost:

    ```cloudflared tunnel --url http://localhost:3000```


3. Use the url given by the command above and put it in the Farcaster Preview Tool in the Developers section

*Don't forget to run the dev server:*
```npm run dev```

---------------------------------------------------------------------

That will start the server, in the terminal it will tell you what local host to put in your browser, usually its "localhost:3000"

*PLEASE NOTE:* The first run will take a bit of time before it is viewable, the app is compiling, once done they screen will either refresh to the home screen or go to a black screen,
if it is a black screen just refresh the browser window, you can make changes in real to the files and the browser will update automotically, just dont close the terminal window where
you ran npm run

To edit the tabs in the app those are held in the directory:
```/src/components/ui/tabs```

The ui directory holds the header and footer to edit the menu

The files labled ***(old)
are the original files provided by farcaster, look in their for ideas on how to do things

---------------------------------------------------------------------

## Testing ##
Vitest and c8 for testing frontend JS and TS. Pytest and pytest-cov for testing backend python.

### Test Command ###
JS/TS Frontend Testing: `make frontend-test`
Python Backend Testing: `make backend-test`

If there is an error for frontend, try manually installing vitest and c8 again with `npm install --save-dev vitest c8`

### Test File Locations ###
Javascript, typescript, and python test files are located in `tests/`. This is where to write new tests.
