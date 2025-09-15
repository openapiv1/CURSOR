# AI SDK Computer Use Demo

## Overview

This is a Next.js application that demonstrates AI-powered computer automation using Google Generative AI and the E2B Desktop environment. The application allows users to interact with a virtual desktop through natural language commands, where an AI agent can perform actions like clicking, typing, taking screenshots, and navigating applications within a sandboxed environment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 15 with React 19, using the App Router pattern
- **UI Components**: Built with shadcn/ui components based on Radix UI primitives
- **Styling**: Tailwind CSS with custom theme configuration and animations
- **State Management**: React hooks for local state, custom chat hook for message handling
- **Real-time Updates**: Custom streaming chat implementation with typewriter effects

### Backend Architecture
- **API Routes**: Next.js API routes handling chat interactions and desktop management
- **AI Integration**: Google Generative AI (Gemini) for natural language processing and computer use capabilities
- **Computer Control**: E2B Desktop sandbox for safe execution of computer actions
- **Streaming**: Custom stream parser for real-time AI responses with tool invocations

### Core Components
- **Chat Interface**: Real-time messaging with support for text, images, and tool results
- **Desktop Viewer**: Embedded iframe displaying the E2B desktop environment
- **Computer Tool**: Comprehensive tool for desktop automation (screenshots, clicks, typing, scrolling)
- **Message System**: Custom message handling with support for multi-modal content

### Caching Strategy
- **Aggressive No-Cache Policy**: Complete cache disabling across all levels
- **Real-time Data**: All responses are served fresh with cache-control headers
- **Dynamic Content**: Forced dynamic rendering with unique build IDs

## External Dependencies

### AI Services
- **Google Generative AI**: Primary AI model for natural language understanding and computer use
- **AI SDK**: Vercel's AI SDK for structured AI interactions and tool calling

### Desktop Virtualization
- **E2B Desktop**: Cloud-based desktop environment for safe computer automation
- **E2B API**: RESTful API for managing sandbox lifecycle and desktop streaming

### Database & Storage
- **Supabase**: PostgreSQL database for chat session and message persistence
- **Real-time Subscriptions**: Supabase real-time for live data synchronization

### UI & Styling
- **Radix UI**: Headless UI components for accessibility and customization
- **Tailwind CSS**: Utility-first CSS framework with custom theme
- **Motion**: Animation library for smooth UI transitions
- **Lucide React**: Icon library for consistent iconography

### Development Tools
- **TypeScript**: Type safety and developer experience
- **Next.js Middleware**: Request/response manipulation for cache control
- **Vercel Analytics**: Application performance monitoring