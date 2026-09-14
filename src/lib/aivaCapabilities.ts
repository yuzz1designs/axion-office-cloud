export const MAC_TOOLS = {
  open_application: "Abre uma aplicação instalada pelo nome application, por exemplo Google Chrome, Safari ou Spotify.",
  open_website: "Abre url HTTP/HTTPS no browser do Mac. application opcional: Google Chrome ou Safari.",
  browser_search: "Abre uma pesquisa Google por query no browser real do Mac.",
  list_directory: "Lista ficheiros e pastas em path sem ler conteúdos.",
  create_directory: "Cria uma pasta em path sem substituir nada.",
  organize_files: "Organiza os ficheiros diretamente em path por strategy type ou month. Primeiro usa preview=true para inspecionar o plano; depois preview=false. Nunca substitui ficheiros.",
  computer_screenshot: "Observa o ecrã principal do Mac a pedido. Devolve imagem e coordenadas; requer permissão Gravação do ecrã.",
  computer_click: "Clica em x,y do ecrã observado, button left ou right. Requer confirmação do utilizador antes de interagir com aplicações externas.",
  computer_type: "Escreve text na aplicação focada, após confirmação. Não executa comandos de terminal.",
  computer_key: "Pressiona key (enter, escape, tab, backspace, up, down, left, right, space) com modifier opcional command, shift, option, control; após confirmação.",
  computer_scroll: "Desloca o ecrã observado por deltaY e deltaX opcionais.",
  computer_close_window: "Fecha o separador, janela, pasta do Finder ou documento ativo na aplicação indicada em application. Usa Safari/Chrome para separadores, Finder para pastas e a aplicação que mostra o documento para ficheiros. Alterações por guardar continuam sujeitas ao diálogo da aplicação.",
  computer_quit_application: "Termina a aplicação indicada em application. Alterações por guardar continuam sujeitas ao diálogo da aplicação.",
  get_system_info: "Informação básica do Mac e sessão atual.",
  get_battery_status: "Percentagem de bateria e fonte de alimentação.",
  get_network_status: "Estado básico da ligação, sem endereços privados.",
  get_system_volume: "Volume e estado mute do Mac.",
  set_system_volume: "Altera o volume do Mac para percent (0 a 100).",
  set_system_muted: "Define mute através de muted (boolean).",
  read_clipboard: "Lê clipboard só quando o utilizador pedir explicitamente.",
  write_clipboard: "Copia text para o clipboard.",
  show_notification: "Mostra uma notificação AXION com text.",
  open_finder: "Abre uma janela do Finder na pasta pessoal do utilizador. Não lê ficheiros nem controla a interface do Finder. Usa para pedidos como abre o Finder.",
  find_file: "Procura query nas pastas autorizadas, sem ler conteúdos.",
  read_file: "Lê ficheiro de texto autorizado em path.",
  create_file: "Cria ficheiro de texto em path com text. Nunca substitui ficheiros.",
  copy_file: "Copia path para destination sem substituir ficheiros.",
  move_file: "Move ou renomeia path para destination sem substituir ficheiros.",
  open_file: "Abre documento autorizado em path sem controlar a aplicação.",
  reveal_file: "Mostra ficheiro autorizado em path no Finder.",
  sleep_mac: "Coloca o Mac em repouso apenas a pedido explícito.",
  run_shell_command: "Executa command com zsh dentro de cwd, que tem de ser uma pasta autorizada. Não permite sudo e exige confirmação explícita.",
} as const;
export type MacTool = keyof typeof MAC_TOOLS;
export const isMacTool = (name: string): name is MacTool => Object.hasOwn(MAC_TOOLS, name);
export const MAC_MUTATIONS = new Set<string>(["open_application", "open_website", "browser_search", "create_directory", "organize_files", "computer_click", "computer_type", "computer_key", "computer_scroll", "computer_close_window", "computer_quit_application", "set_system_volume", "set_system_muted", "write_clipboard", "show_notification", "open_finder", "create_file", "copy_file", "move_file", "open_file", "reveal_file", "sleep_mac", "run_shell_command"]);
export const COMPUTER_CONFIRM_TOOLS = new Set(["computer_click", "computer_type", "computer_key", "computer_close_window", "computer_quit_application", "run_shell_command"]);
export const COMPUTER_VISION_TOOLS = new Set(["computer_screenshot", "computer_click", "computer_type", "computer_key", "computer_scroll", "computer_close_window", "computer_quit_application"]);
export interface DesktopStatus { connected: boolean; deviceName?: string; capabilities: string[]; reason?: string; runtime?: "desktop"; roots?: string[]; shell?: boolean; permissions?: { accessibility: boolean; screenRecording: boolean; authorizedFolders: boolean; }; }
export interface BrainAvailability { id: "mark-i" | "mark-ii"; available: boolean; reason?: string; capabilities: string[]; }
export function filterDeviceTools<T extends { name: string }>(tools: T[], brain: string, capabilities: string[]) {
  return tools.filter(tool => !isMacTool(tool.name) || (brain === "mark-ii" && capabilities.includes(tool.name)));
}
