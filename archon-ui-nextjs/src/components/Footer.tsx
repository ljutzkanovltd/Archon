export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="px-4 py-4 lg:px-6">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} Archon Dashboard. SportERP Platform.
        </p>
      </div>
    </footer>
  );
}
