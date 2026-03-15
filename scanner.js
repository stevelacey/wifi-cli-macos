const p = process.platform
if (!['darwin', 'linux'].includes(p)) { console.error(`Platform '${p}' is not supported`); process.exit(1) }

export const { connect, current, disconnect, ensure, forget, scan } = await import(`./platforms/${p}/scanner.js`)
