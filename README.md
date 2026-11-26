[README.new-06f217b7.md](https://github.com/user-attachments/files/35466223/README.new-06f217b7.md)
# El-3bbas System (العباس ستور)

A full-stack retail management system for managing store inventory, sales and analytics. Built with a React frontend and a Node.js / Express / MongoDB backend, with JWT authentication and role-based access for admins and employees.

## Features

- User authentication with JWT
- Role-based access (Admin / Employee)
- Product management (CRUD)
- Sales management
- Real-time stock updates and low-stock notifications (Socket.io)
- Dashboard analytics: daily and monthly sales, profit, best-selling products

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Zustand, React Router, Axios, Recharts, Socket.io client |
| Backend | Node.js, Express, Socket.io |
| Database | MongoDB (Mongoose) |
| Auth | JSON Web Tokens (JWT), bcrypt |
| Deployment | Vercel |

## Screenshots

| Login | Products |
| --- | --- |
| <img src="https://github.com/user-attachments/assets/10b8e925-9e1d-4052-ad81-349f86c97e52" alt="Login page" width="420"> | <img src="https://github.com/user-attachments/assets/cc90c41f-679b-40d4-8f3c-7a1befcd6485" alt="Dashboard with sales overview" width="420"> |

| Dashboard | Sales |
| --- | --- |
| <img src="https://github.com/user-attachments/assets/2ad58d37-8c49-498f-9248-b018b10444cc" alt="Products management" width="420"> | <img src="https://github.com/user-attachments/assets/7adeaa58-134f-4814-aac4-369cd0a0aff4" alt="Sales and new invoice" width="420"> |

| Settings |
| --- |
| <img src="https://github.com/user-attachments/assets/b432b1a0-03ef-4d30-8d0e-25ad88c1065a" alt="Profile and account settings" width="420"> |

## Getting Started

### Prerequisites

- Node.js 18 or later
- A MongoDB database (local or MongoDB Atlas)

### 1. Clone the repository

```bash
git clone https://github.com/ahmedkholady/El-3bbas-System.git
cd El-3bbas-System
```

### 2. Run the backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:5173
```

Start the server (optionally seed sample data first):

```bash
npm run data:import   # optional: import sample data
npm run dev
```

### 3. Run the frontend

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:5000
```

```bash
npm run dev
```

The app opens at `http://localhost:5173`.

## Project Structure

```
El-3bbas-System/
├── backend/    # Express API: routes, controllers, models, middlewares
└── frontend/   # React app: pages, components, store, services
```

## Author

Ahmed Kholady

- GitHub: [@ahmedkholady](https://github.com/ahmedkholady)
- Portfolio: [ahmedkholady.github.io/portfolio](https://ahmedkholady.github.io/portfolio)
