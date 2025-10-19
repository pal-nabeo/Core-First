import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const dataUploadApi = new Hono<{ Bindings: CloudflareBindings }>();

// Stub implementation
dataUploadApi.post('/upload', (c) => {
  return c.json({ 
    success: true, 
    message: 'Implementation in progress' 
  });
});

export default dataUploadApi;
