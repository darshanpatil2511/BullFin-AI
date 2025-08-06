import Navbar from './components/Navbar.jsx';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="p-8">
        <h1 className="text-4xl font-extrabold mb-4">
          Welcome to BullFin.AI
        </h1>
        <button className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
          Run Analysis
        </button>
      </main>
    </div>
  );
}

export default App;