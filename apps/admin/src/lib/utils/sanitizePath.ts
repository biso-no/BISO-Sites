export function sanitizePath(path: string) {
    return path
      .split('/')
      .map(segment => 
        segment
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9-_]/g, '')
          .toLowerCase()
      )
      .join('/');
  }