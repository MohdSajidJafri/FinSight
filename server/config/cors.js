const corsOptions = {
  origin: [
    'https://fin-sight-ten.vercel.app/login',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
};

module.exports = corsOptions; 