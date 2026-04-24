import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Testing connection to:', url)

const supabase = createClient(url, key)

async function test() {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('Supabase error:', error)
    } else {
      console.log('Supabase success:', data)
    }
  } catch (err) {
    console.error('Network error:', err)
  }
}

test()
