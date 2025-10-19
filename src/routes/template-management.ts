import { Hono } from 'hono';
import type { CloudflareBindings } from '../types/auth';

const templateManagementApi = new Hono<{ Bindings: CloudflareBindings }>();

// Stub implementation
templateManagementApi.get('/templates', (c) => {
  return c.json({ 
    success: true, 
    message: 'Implementation in progress',
    templates: []
  });
});

export default templateManagementApi;
