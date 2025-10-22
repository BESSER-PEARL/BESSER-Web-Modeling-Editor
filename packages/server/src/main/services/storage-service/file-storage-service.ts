import { promises } from 'fs';

export class FileStorageService {
  getFileContent(path: string): Promise<string> {
    return promises.readFile(path).then((buffer: Buffer) => {
      return buffer.toString('utf-8');
    });
  }

  saveContentToFile(path: string, content: string): Promise<void> {
    return promises.writeFile(path, content, 'utf-8');
  }

  doesFileExist(path: string): Promise<boolean> {
    return promises
      .stat(path)
      .then((stat) => stat.isFile() || stat.isDirectory())
      .catch(() => {
        return false;
      });
  }
}
