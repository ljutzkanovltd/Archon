# Archon Next.js Dashboard

Modern dashboard for Archon knowledge base and task management system, built with Next.js 15 and Flowbite React.

## Project Overview

This is a new Next.js implementation of the Archon dashboard, running on **port 3738** alongside the existing React dashboard (port 3737) for a smooth transition.

## Technology Stack

- **Framework**: Next.js 15.5.6 (App Router)
- **UI Library**: Flowbite React 0.12.13
- **Styling**: Tailwind CSS 4.1.1
- **State Management**: Zustand 5.0.5
- **Language**: TypeScript 5.8+
- **HTTP Client**: Axios
- **Icons**: React Icons

## Getting Started

### Installation

```bash
npm install
```

### Development

Run the development server on port 3738:

```bash
npm run dev
```

Open [http://localhost:3738](http://localhost:3738) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
archon-ui-nextjs/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (root)/         # Main authenticated routes
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx    # Dashboard
│   │   │   ├── projects/
│   │   │   ├── tasks/
│   │   │   ├── documents/
│   │   │   └── knowledge-base/
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/         # React components
│   │   ├── common/
│   │   ├── Projects/
│   │   ├── Tasks/
│   │   └── Documents/
│   ├── contexts/          # React contexts
│   ├── store/             # Zustand stores
│   ├── lib/               # Utilities
│   └── hooks/             # Custom hooks
├── public/                # Static assets
└── ...config files
```

## Features

- 🎨 **Modern UI**: Flowbite React components with Tailwind CSS
- 📱 **Responsive**: Mobile-first design with collapsible sidebar
- 🌗 **Dark Mode**: Built-in dark mode support
- 📊 **DataTable**: Advanced table with filtering, sorting, pagination
- 🎯 **Type-Safe**: Full TypeScript support
- 🔄 **State Management**: Zustand with persistence
- 🚀 **Fast**: Next.js 15 App Router with React Server Components

## API Integration

The dashboard connects to the Archon backend API running on port 8181:

- **Backend API**: http://localhost:8181
- **MCP Server**: http://localhost:8051

## Development Progress

Track all implementation tasks in Archon:
- Project ID: ffa3f313-a623-496f-b4e8-066acb6310f4
- View tasks: http://localhost:3737 (existing dashboard)

## License

Private project for SportERP platform.
