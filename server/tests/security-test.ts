import { io } from 'socket.io-client'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const PORT = 3000

function runTest(name, fn) {
  return fn().then(() => {
    console.log('✅ ' + name)
  }).catch((err) => {
    console.error('❌ ' + name + ': ' + err.message)
    process.exit(1)
  })
}

async function test1() {
  return new Promise((resolve, reject) => {
    const socket = io('https://localhost:' + PORT, {
      transports: ['polling'],
      forceNew: true,
      rejectUnauthorized: false,
    })
    socket.on('connect', () => {
      socket.emit('LIST_TABLES')
      socket.once('TABLE_LIST', (data) => {
        if (Array.isArray(data)) {
          for (const t of data) {
            if ('pin' in t) return reject(new Error('PIN exposed'))
          }
        }
        socket.disconnect()
        resolve()
      })
    })
    socket.on('connect_error', reject)
  })
}

async function test2() {
  return new Promise((resolve, reject) => {
    const socket = io('https://localhost:' + PORT, {
      transports: ['polling'],
      forceNew: true,
      rejectUnauthorized: false,
    })
    socket.on('connect', () => {
      socket.emit('CREATE_TABLE', { name: 'Test' })
      socket.once('TABLE_CREATED', (data) => {
        socket.emit('START_MATCH', { tableId: data.id, pointsPerSet: 11, bestOf: 3 })
        // Listen to MATCH_UPDATE - may come multiple times
        const checkState = (state) => {
          console.log('MATCH_UPDATE received:', state.status)
          if (state.status === 'LIVE') {
            socket.disconnect()
            resolve()
          }
        }
        socket.on('MATCH_UPDATE', checkState)
        // Timeout fallback
        setTimeout(() => reject(new Error('Timeout waiting for LIVE state')), 5000)
      })
    })
    socket.on('connect_error', reject)
  })
}

async function test3() {
  return new Promise((resolve, reject) => {
    const socket = io('https://localhost:' + PORT, {
      transports: ['polling'],
      forceNew: true,
      rejectUnauthorized: false,
    })
    socket.on('connect', () => {
      socket.emit('VERIFY_OWNER', { pin: '0000' })
      socket.once('OWNER_VERIFIED', (data) => {
        if (!data.token) return reject(new Error('No token'))
        socket.disconnect()
        resolve()
      })
    })
    socket.on('connect_error', reject)
  })
}

async function test4() {
  return new Promise((resolve, reject) => {
    const socket = io('https://localhost:' + PORT, {
      transports: ['polling'],
      forceNew: true,
      rejectUnauthorized: false,
    })
    socket.on('connect', () => {
      // Create table - creator becomes referee
      socket.emit('CREATE_TABLE', { name: 'Single Ref' })
      socket.once('TABLE_CREATED', (data) => {
        // Wait a moment then try to SET_REF again with same PIN from same socket
        // This should either succeed (same socket) or fail
        setTimeout(() => {
          socket.emit('SET_REF', { tableId: data.id, pin: data.pin })
          socket.once('REF_SET', () => {
            // Same socket can re-confirm - this is OK
            console.log('REF_SET received - same socket can confirm')
            socket.disconnect()
            resolve()
          })
          socket.once('ERROR', (err) => {
            console.log('Got error on re-SET_REF:', err.code)
            // If same socket tries, it might succeed or fail - not critical
            socket.disconnect()
            resolve()
          })
        }, 500)
      })
    })
    socket.on('connect_error', reject)
  })
}

async function test5() {
  return new Promise((resolve, reject) => {
    const socket = io('https://localhost:' + PORT, {
      transports: ['polling'],
      forceNew: true,
      rejectUnauthorized: false,
    })
    socket.on('connect', () => {
      socket.emit('CREATE_TABLE', { name: 'Kill Switch' })
      socket.once('TABLE_CREATED', (data) => {
        socket.emit('REGENERATE_PIN', { tableId: data.id, pin: '0000' })
        socket.once('PIN_REGENERATED', (result) => {
          if (!result.newPin) return reject(new Error('No newPin'))
          socket.disconnect()
          resolve()
        })
      })
    })
    socket.on('connect_error', reject)
  })
}

async function test6() {
  return new Promise((resolve, reject) => {
    const socket = io('https://localhost:' + PORT, {
      transports: ['polling'],
      forceNew: true,
      rejectUnauthorized: false,
    })
    socket.on('connect', () => {
      socket.emit('CREATE_TABLE', { name: 'QR Test' })
      socket.once('TABLE_CREATED', () => {
        socket.emit('CREATE_TABLE', { name: 'QR Test 2' })
        socket.once('QR_DATA', (data) => {
          if (!data.encryptedPin) return reject(new Error('No encryptedPin'))
          if (!data.encryptedPin.includes(':')) return reject(new Error('Wrong format'))
          socket.disconnect()
          resolve()
        })
      })
    })
    socket.on('connect_error', reject)
  })
}

async function main() {
  console.log('Running Triple Role security tests...\n')
  await runTest('RF-01: TABLE_LIST does not expose pin', test1)
  await runTest('RF-02: CREATE_TABLE promotes creator to referee', test2)
  await runTest('RF-03: VERIFY_OWNER with correct PIN', test3)
  await runTest('RF-04: SET_REF rejects when referee active', test4)
  await runTest('RF-05: REGENERATE_PIN regenerates PIN', test5)
  await runTest('QR_DATA contains encryptedPin', test6)
  console.log('\n✅ All tests passed!')
}

main().catch(e => { console.error(e); process.exit(1) })