export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        colorScheme?: "light" | "dark";
        onEvent?: (
          eventType: "themeChanged",
          eventHandler: () => void,
        ) => void;
        offEvent?: (
          eventType: "themeChanged",
          eventHandler: () => void,
        ) => void;
        ready?: () => void;
        expand?: () => void;
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}
