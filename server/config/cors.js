const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://localhost:5173'
];

const configuredOrigins = [];
if (process.env.CORS_ORIGIN) {
  configuredOrigins.push(...process.env.CORS_ORIGIN.split(',').map(s => s.trim().replace(/\/$/, '')));
}
if (process.env.CLIENT_URL) {
  configuredOrigins.push(...process.env.CLIENT_URL.split(',').map(s => s.trim().replace(/\/$/, '')));
}

const allowlist = Array.from(new Set([...configuredOrigins, ...defaultOrigins]));

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    const normalizedOrigin = origin.trim().replace(/\/$/, '');
    if (allowlist.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    // Return false without throwing an unhandled exception
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['set-cookie']
};

module.exports = corsOptions; 