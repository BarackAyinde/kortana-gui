export interface CommandDef {
  usage: string
  description: string
}

export const COMMANDS: Record<string, CommandDef> = {
  pwd:     { usage: 'pwd',                               description: 'Print current path.' },
  ls:      { usage: 'ls [path]',                         description: 'List nodes at current location or given path.' },
  cd:      { usage: 'cd <path>',                         description: 'Navigate to a path. Supports relative, absolute, and ..' },
  cat:     { usage: 'cat <node-id>',                     description: 'Display full content of a node. Use . when at node level.' },
  grep:    { usage: 'grep <query> [--type <nodeType>]',  description: 'Full-text search across all nodes.' },
  find:    { usage: 'find <query>',                      description: 'Alias for grep with no type filter.' },
  link:    { usage: 'link <src> <tgt> [--type <edge>]',  description: 'Create an edge between two nodes.' },
  unlink:  { usage: 'unlink <src> <tgt>',               description: 'Delete the edge between two nodes (with confirmation).' },
  touch:   { usage: 'touch <node-id> [--type <type>]',   description: 'Create a new node and open it in Code Editor.' },
  rm:      { usage: 'rm <node-id>',                      description: 'Delete a node (with confirmation).' },
  history: { usage: 'history',                           description: 'Show last 20 commands.' },
  help:    { usage: 'help [command]',                    description: 'Show all commands, or full usage for one command.' },
  clear:   { usage: 'clear',                             description: 'Clear the terminal output.' },
}
