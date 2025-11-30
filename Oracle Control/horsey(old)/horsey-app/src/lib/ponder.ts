import { createClient } from '@ponder/client'
import * as schema from '../../../horsey-ponder/ponder.schema'

export const ponderClient = createClient('http://localhost:42069/sql', { schema })

// Module augmentation for type safety
declare module '@ponder/react' {
  interface Register {
    schema: typeof schema
  }
}
