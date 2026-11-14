import { createInbox, createPreferences } from 'pingly';
import { inboxApi, preferencesApi } from './backend/api';

export const inbox = createInbox({
  adapter: inboxApi,
  pageSize: 10,
  syncTabs: 'pingly-playground',
});

export const preferences = createPreferences({
  adapter: preferencesApi,
  categories: [
    { id: 'comments', label: 'Comments', description: 'Replies and comments on your posts' },
    { id: 'mentions', label: 'Mentions', description: 'When someone @mentions you' },
    { id: 'billing', label: 'Billing', description: 'Invoices and payments', locked: ['email'] },
    {
      id: 'deploys',
      label: 'Deploys',
      description: 'Build and deploy results',
      channels: ['inApp', 'browser'],
    },
    {
      id: 'security',
      label: 'Security',
      description: 'Sign-ins and account changes',
      locked: ['inApp', 'email'],
    },
  ],
  channels: [
    { id: 'inApp', label: 'In-app' },
    { id: 'browser', label: 'Desktop' },
    { id: 'email', label: 'Email' },
  ],
});
