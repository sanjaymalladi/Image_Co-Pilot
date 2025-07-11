// @ts-nocheck

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider, SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { Button } from './components/Button';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment variables');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const Unauthenticated: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-secondary p-4">
    <h1 className="text-3xl font-bold mb-6 text-center">Welcome to Image Co-Pilot</h1>
    <SignInButton mode="modal">
      <Button className="text-lg px-6 py-3">Sign in to continue</Button>
    </SignInButton>
  </div>
);

root.render(
  <ClerkProvider publishableKey={publishableKey}>
    <SignedIn>
      <React.StrictMode>
        <App />
      </React.StrictMode>
    </SignedIn>
    <SignedOut>
      <Unauthenticated />
    </SignedOut>
  </ClerkProvider>
);
