// Test: spawn headroom.exe detached exactly like the plugin does, then exit.
const { spawn } = require('node:child_process')
const child = spawn('D:\\python\\Scripts\\headroom.exe', [
  'proxy', '--port', '8787',
  '--anthropic-api-url', 'https://api.deepseek.com/anthropic',
  '--openai-api-url', 'https://api.deepseek.com',
  '--host', '127.0.0.1',
  '--connect-timeout-seconds', '15',
  '--request-timeout-seconds', '120',
  '--log-file', process.env.USERPROFILE + '\\.headroom\\proxy.log',
], { detached: true, stdio: 'ignore' })
child.unref()
console.log('spawned pid:', child.pid)
setTimeout(() => process.exit(0), 2000)
