export const Greeting = () => {
  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-center"
    >
      <div className="flex justify-center mb-6">
        <img
          src="https://integration.app/images/logo--dark.svg"
          alt="Integration App Logo"
          className="h-10 w-auto dark:hidden"
        />
        <img
          src="https://integration.app/images/logo--white.svg"
          alt="Integration App Logo"
          className="h-10 w-auto hidden dark:block"
        />
      </div>

      <p className="text-md text-gray-900 dark:text-white/90 leading-relaxed text-center">
        <a
          href="http://integration.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-200 transition-colors duration-200 underline underline-offset-4 font-bold"
        >
          Integration App
        </a>{' '}
        is a powerful platform for building and running integrations. This Demo
        leverages the{' '}
        <a
          href="https://github.com/integration-app/mcp-server"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-200 transition-colors duration-200 underline underline-offset-4 font-bold"
        >
          Integration App MCP server
        </a>{' '}
        to provide seamless integration capabilities to AI agents, enabling them
        to interact over{' '}
        <a
          href="https://integration.app/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-200 transition-colors duration-200 underline underline-offset-4 font-bold"
        >
          3k+ apps
        </a>
        .
      </p>
    </div>
  );
};
