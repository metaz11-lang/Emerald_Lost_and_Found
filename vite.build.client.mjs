import path from 'path';
import { fileURLToPath } from 'url';

const downloadsClient = path.resolve('C:/Users/metaz/Downloads/Emerald-Lost-and-Found/Emerald-Lost-and-Found/client');

export default {
  root: downloadsClient,
  resolve: {
    alias: {
      '@': path.resolve(downloadsClient, 'src'),
      '@lib': path.resolve(downloadsClient, 'src', 'lib'),
      '@shared': path.resolve('C:/Users/metaz/Downloads/Emerald-Lost-and-Found/Emerald-Lost-and-Found/shared'),
      '@assets': path.resolve('C:/Users/metaz/Downloads/Emerald-Lost-and-Found/Emerald-Lost-and-Found/attached_assets')
    }
  },
  build: {
    outDir: path.resolve('C:/Users/metaz/Documents/GitHub/Emerald_Lost_and_Found/public'),
    emptyOutDir: true
  }
};
