import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import apiKeyRoutes from './routes/apiKeys.routes';
import proxyRoutes from './routes/proxy.routes';
import analyticsRoutes from './routes/analytics.routes';

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*'
}));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/keys', apiKeyRoutes);
app.use('/v1', proxyRoutes);
app.use('/analytics', analyticsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
export default app;
