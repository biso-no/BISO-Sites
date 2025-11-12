# Bunpack

Bunpack is a Next.js application with TypeScript and Tailwind CSS.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Installation](#installation)
3. [Usage](#usage)
4. [Configuration](#configuration)
5. [API Routes](#api-routes)
6. [Components](#components)
7. [Styling](#styling)
8. [Deployment](#deployment)
9. [Contributing](#contributing)
10. [License](#license)

## Project Structure

```
bunpack/
├── .next/
├── app/
├── components/
├── lib/
├── public/
├── .env
├── .env.example
├── .eslintrc.js
├── .gitignore
├── bun.lockb
├── components.json
├── database.json
├── middleware.ts
├── next-env.d.ts
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## Installation

See [Installation Guide](docs/installation.md) for detailed instructions.

## Usage

See [Usage Guide](docs/usage.md) for information on how to use Bunpack.

## Configuration

- `next.config.js`: Next.js configuration
- `tsconfig.json`: TypeScript configuration
- `tailwind.config.js`: Tailwind CSS configuration
- `postcss.config.js`: PostCSS configuration
- `.eslintrc.js`: ESLint configuration

## API Routes

API routes can be accessed on `/api/*`. This directory is mapped to `/app/api/*`.

## Components

Reusable components are stored in the `components/` directory.

## Styling

This project uses Tailwind CSS for styling. The configuration can be found in `tailwind.config.js`.

## Deployment

Follow the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for detailed instructions on how to deploy your app.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
