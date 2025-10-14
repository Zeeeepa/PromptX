import type { ToolWithHandler } from '~/interfaces/MCPServer.js';
import { MCPOutputAdapter } from '~/utils/MCPOutputAdapter.js';
import yaml from 'js-yaml';

const outputAdapter = new MCPOutputAdapter();

export const toolxTool: ToolWithHandler = {
  name: 'toolx',

  description: `ToolX is the PromptX tool runtime for loading and executing various tools.

Architecture:
• You (Agent/AI) run in Client (VSCode/Cursor)
• Client connects to MCP Server (PromptX) via MCP protocol
• MCP Server exposes tools, including toolx
• toolx is an MCP tool for loading and executing PromptX ecosystem tools (tool://xxx)

⚠️ IMPORTANT: First time using any tool, you MUST use mode: manual to read the manual ⚠️

Usage: The "yaml" parameter must be a complete YAML document (not just a URL string):

\`\`\`yaml
tool: tool://tool-name
mode: execute
parameters:
  paramName: paramValue
\`\`\`

CORRECT examples:
✅ "tool: tool://filesystem\\nmode: manual"
✅ "tool: tool://pdf-reader\\nmode: execute\\nparameters:\\n  path: /file.pdf"

WRONG examples:
❌ "tool://filesystem" (missing YAML structure)
❌ "@tool://filesystem" (don't add @ prefix, system handles it)
❌ "tool: filesystem" (missing tool:// prefix)

Field aliases (all supported):
• tool / toolUrl / url - Tool identifier (priority: tool > toolUrl > url)
• mode / operation - Operation mode (priority: mode > operation)

Note: Always use "tool://" prefix (without @). The system converts it internally.

Mode options:
• manual - View tool manual [MUST run first]
  Example:
  tool: tool://tool-creator
  mode: manual

• execute - Execute tool function (default)
  Example:
  tool: tool://tool-creator
  mode: execute
  parameters:
    tool: my-tool
    action: write
    file: my-tool.tool.js
    content: |
      module.exports = {
        execute() { return 'hello'; }
      };

• configure - Configure environment variables
  Example:
  tool: tool://my-tool
  mode: configure
  parameters:
    API_KEY: sk-xxx123
    TIMEOUT: 30000

• rebuild - Rebuild dependencies
  Example:
  tool: tool://my-tool
  mode: rebuild

• log - View logs
  Example:
  tool: tool://my-tool
  mode: log
  parameters:
    action: tail
    lines: 100

• dryrun - Simulate execution
  Example:
  tool: tool://my-tool
  mode: dryrun
  parameters:
    input: test-data

System tools (no discovery needed):
- tool://filesystem - File system operations
- tool://role-creator - Create AI roles (Nuwa's tool)
- tool://tool-creator - Create tools (Luban's tool)
- tool://pdf-reader - Read PDF files
- tool://excel-tool - Process Excel files (read/write/modify)
- tool://word-tool - Process Word files (read/write/modify)

`,

  inputSchema: {
    type: 'object',
    properties: {
      yaml: {
        type: 'string',
        description: 'YAML 格式的工具调用配置'
      }
    },
    required: ['yaml']
  },

  handler: async (args: { yaml: string }) => {
    try {
      // Auto-correct common AI mistakes
      let yamlInput = args.yaml.trim();

      // Case 1: Just a plain URL string like "tool://filesystem" or "@tool://filesystem"
      if (yamlInput.match(/^@?tool:\/\/[\w-]+$/)) {
        const toolName = yamlInput.replace(/^@?tool:\/\//, '');
        yamlInput = `tool: tool://${toolName}\nmode: execute`;
      }

      // Case 2: Handle escaped backslashes and quotes: tool: \"@tool://xxx\"
      // This happens when AI generates YAML in a JSON string
      yamlInput = yamlInput.replace(/\\\\/g, '\\').replace(/\\"/g, '"');

      // Case 3: Remove @ prefix from tool URLs: @tool://xxx -> tool://xxx
      yamlInput = yamlInput.replace(/@tool:\/\//g, 'tool://');

      // Case 4: Remove quotes around tool URLs: tool: "tool://xxx" -> tool: tool://xxx
      yamlInput = yamlInput.replace(/(tool|toolUrl|url):\s*"(tool:\/\/[^"]+)"/g, '$1: $2');

      // YAML → JSON conversion
      const config = yaml.load(yamlInput) as any;

      // Normalize field names (support aliases for AI-friendliness)
      // Priority: tool > toolUrl > url
      const toolIdentifier = config.tool || config.toolUrl || config.url;

      // Priority: mode > operation
      const operationMode = config.mode || config.operation;

      // Validate required fields
      if (!toolIdentifier) {
        throw new Error('Missing required field: tool\nExample: tool: tool://filesystem\nAliases supported: tool / toolUrl / url');
      }

      // Validate URL format
      if (!toolIdentifier.startsWith('tool://')) {
        throw new Error(`Invalid tool format: ${toolIdentifier}\nMust start with tool://`);
      }

      // Convert to internal @tool:// format (compatibility with core system)
      const internalUrl = toolIdentifier.replace('tool://', '@tool://');

      // Get core module
      const core = await import('@promptx/core');
      const coreExports = core.default || core;
      const cli = (coreExports as any).cli || (coreExports as any).pouch?.cli;

      if (!cli || !cli.execute) {
        throw new Error('CLI not available in @promptx/core');
      }

      // Build CLI arguments (maintain original interface)
      const cliArgs = [internalUrl];
      cliArgs.push(operationMode || 'execute');

      if (config.parameters) {
        cliArgs.push(JSON.stringify(config.parameters));
      }

      if (config.timeout) {
        cliArgs.push('--timeout', config.timeout.toString());
      }

      // Execute
      const result = await cli.execute('toolx', cliArgs);
      return outputAdapter.convertToMCPFormat(result);

    } catch (error: any) {
      // YAML parsing errors
      if (error.name === 'YAMLException') {
        // Check for multiline string issues
        if (error.message.includes('bad indentation') || error.message.includes('mapping entry')) {
          throw new Error(`YAML format error: ${error.message}\n\nMultiline content requires | symbol, example:\ncontent: |\n  First line\n  Second line\n\nNote: Newline after |, indent content with 2 spaces`);
        }
        throw new Error(`YAML format error: ${error.message}\nCheck indentation (use spaces) and syntax`);
      }

      // Tool not found
      if (error.message?.includes('Tool not found')) {
        const toolName = args.yaml.match(/(?:tool|toolUrl|url):\s*tool:\/\/(\w+)/)?.[1];
        throw new Error(`Tool '${toolName}' not found\nUse discover to view available tools`);
      }

      throw error;
    }
  }
};