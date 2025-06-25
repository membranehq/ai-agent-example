export const Greeting = () => {
  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-center"
    >
      <div className="flex justify-center mb-6 h-10">
        <svg
          viewBox="0 0 470 284"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M234.571 68.9736L213.137 89.9517L214.035 90.8287C231.656 108.033 240.462 116.635 244.103 126.42C247.956 136.757 247.956 148.136 244.103 158.473C240.462 168.257 231.656 176.869 214.035 194.073L235.459 215.002L255.057 195.857C274.403 176.968 284.066 167.518 287.606 156.591C290.582 147.396 290.582 137.497 287.606 128.302C284.066 117.374 274.403 107.925 255.057 89.0357L234.571 68.9736ZM234.571 68.9736L199.591 34.8517C180.256 15.9617 170.583 6.51265 159.366 3.06465C149.931 0.147803 139.834 0.147803 130.398 3.06465C119.212 6.51265 109.549 15.9627 90.2043 34.8517L34.7283 89.0456C15.4433 107.925 5.77027 117.374 2.23927 128.302C-0.746423 137.495 -0.746423 147.397 2.23927 156.591C5.76927 167.508 15.4433 176.968 34.7793 195.857L90.2543 250.051C109.6 268.94 119.263 278.389 130.449 281.848C139.875 284.731 149.949 284.717 159.366 281.808C170.542 278.35 180.215 268.9 199.551 250.011L235.419 214.972L270.398 249.134C289.734 268.033 299.407 277.473 310.583 280.931C320.02 283.838 330.114 283.838 339.551 280.931C350.737 277.473 360.4 268.033 379.746 249.134L435.222 194.94C454.557 176.051 464.23 166.602 467.761 155.684C470.746 146.487 470.746 136.582 467.761 127.385C464.23 116.458 454.557 107.018 435.222 88.1187L379.746 33.9246C360.44 15.0846 350.778 5.63565 339.592 2.18765C330.156 -0.729217 320.059 -0.729217 310.623 2.18765C299.447 5.63565 289.775 15.0856 270.439 33.9746L234.571 68.9736ZM213.137 89.9517C195.526 107.156 186.721 115.758 183.08 125.543C179.227 135.88 179.227 147.259 183.08 157.596C186.721 167.38 195.526 175.992 213.137 193.196L214.035 194.073L199.591 208.183C180.256 227.072 170.583 236.482 159.366 239.97C149.931 242.887 139.834 242.887 130.398 239.97C119.212 236.522 109.549 227.072 90.2043 208.183L77.6663 195.857C58.2903 176.968 48.6273 167.508 45.0863 156.591C42.1105 147.396 42.1105 137.497 45.0863 128.302C48.6273 117.374 58.2903 107.925 77.6663 89.0357L90.2743 76.7187C109.62 57.8197 119.283 48.3796 130.47 44.9216C139.906 42.0049 150.003 42.0049 159.438 44.9216C170.614 48.3807 180.287 57.8197 199.623 76.7187L213.138 89.9517H213.137Z"
            fill="currentColor"
          />
        </svg>
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
