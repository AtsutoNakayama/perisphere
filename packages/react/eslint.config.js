import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

import baseConfig from "../../eslint.config.js";

export default tseslint.config(...baseConfig, reactHooks.configs.flat.recommended);
