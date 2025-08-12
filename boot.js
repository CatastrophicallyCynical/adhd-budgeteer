// Boot: apply theme first, then load the app
import { applyTheme } from './theme.js';
applyTheme().finally(() => {
  import('./app.js');
});
