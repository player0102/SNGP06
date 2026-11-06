/** Diffusion temps réel (Server-Sent Events). */
const clients = new Set();

export function subscribe(res) {
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

export function broadcast(type, payload = {}) {
  const data = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch {
      clients.delete(res);
    }
  }
}

export function clientCount() {
  return clients.size;
}

setInterval(() => broadcast('ping', { ts: Date.now() }), 25000).unref();
