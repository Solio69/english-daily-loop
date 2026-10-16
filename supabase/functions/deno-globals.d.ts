declare namespace Deno {
  type ServeHandler = (request: Request) => Response | Promise<Response>
  function serve(handler: ServeHandler): void
  function test(name: string, fn: () => void | Promise<void>): void
  namespace env {
    function get(key: string): string | undefined
  }
}
