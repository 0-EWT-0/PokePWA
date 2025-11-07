import { useEffect, useState, useMemo } from "react";
import "./App.css";

function App() {
  const [pokemons, setPokemons] = useState([]);
  const [count, setCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState("");
  const [allPokemons, setAllPokemons] = useState([]);

  const itemsPerPage = 20;
  const offset = (currentPage - 1) * itemsPerPage;
  const isSearching = searchTerm.trim() !== "";

  useEffect(() => {
    if (isSearching) return;
    fetch(
      `https://pokeapi.co/api/v2/pokemon?limit=${itemsPerPage}&offset=${offset}`
    )
      .then((res) => res.json())
      .then((data) => {
        setPokemons(data.results || []);
        setCount(data.count || 0);
      })
      .catch(console.error);
  }, [offset, isSearching]);

  useEffect(() => {
    fetch(`https://pokeapi.co/api/v2/pokemon?limit=2000&offset=0`)
      .then((res) => res.json())
      .then((data) => setAllPokemons(data.results || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const requestNotifications = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then((result) => {
        console.log("Permiso de notificación:", result);
      });
    }
  };

  const sendLocalNotification = async () => {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta la Notification API.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Debes permitir notificaciones para continuar.");
      return;
    }

    if (!("serviceWorker" in navigator)) {
      // Fallback simple (no recomendado si ya tienes SW): new Notification(...)
      new Notification("¡Pokédex lista!", {
        body: "Sin SW, usando fallback básico.",
      });
      return;
    }

    // Asegura que el SW esté listo
    const reg = await navigator.serviceWorker.ready;

    // Si existe un controller, manda el mensaje directo al SW controlando esta página
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title: "¡Pokemon!",
        body: "Tienes que atraparlos o robarlos",
        url: "/", // cambia si quieres abrir otra ruta
        // icon, badge, image, tag… opcionales
      });
    } else {
      // En algunos casos, utiliza el registro directamente
      if (reg && reg.active) {
        reg.active.postMessage({
          type: "SHOW_NOTIFICATION",
          title: "¡Notificación local!",
          body: "Se envió desde tu PWA sin backend 🎉",
          url: "/",
        });
      } else {
        console.warn("No hay SW activo para recibir el mensaje.");
      }
    }
  };

  const handlePageChange = (pageNumber, totalPages) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
  };

  const getIdFromUrl = (url) => {
    const m = url.match(/\/pokemon\/(\d+)\//);
    return m ? m[1] : "";
  };

  const { visibleList, totalPages } = useMemo(() => {
    if (!isSearching) {
      const totalPagesApi = Math.max(1, Math.ceil(count / itemsPerPage));
      return { visibleList: pokemons, totalPages: totalPagesApi };
    }
    const term = searchTerm.toLowerCase();
    const filtered = allPokemons.filter((p) =>
      p.name.toLowerCase().includes(term)
    );
    const pages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const start = (currentPage - 1) * itemsPerPage;
    const slice = filtered.slice(start, start + itemsPerPage);
    return { visibleList: slice, totalPages: pages };
  }, [isSearching, count, pokemons, allPokemons, searchTerm, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    const spread = 2;
    const start = Math.max(1, currentPage - spread);
    const end = Math.min(totalPages, currentPage + spread);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Guía de Pokemons</h1>

        <div className="searchbar">
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por nombre (ej. pikachu)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {isSearching && (
            <button
              className="clear-btn"
              onClick={() => setSearchTerm("")}
              aria-label="limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
        <button
          className="rounded p-4 bg-orange-300"
          onClick={requestNotifications}
        >
          Activar notificaciones
        </button>
        <button
          className="rounded p-4 bg-orange-300"
          onClick={sendLocalNotification}
        >
          Enviar notificaciones
        </button>
      </header>

      <main className="content">
        {isSearching && (
          <p className="hint">
            Resultados:{" "}
            <strong>
              {
                allPokemons.filter((p) =>
                  p.name.toLowerCase().includes(searchTerm.toLowerCase())
                ).length
              }
            </strong>
          </p>
        )}

        <ul className="grid">
          {visibleList.map((p) => {
            const id = getIdFromUrl(p.url);
            return (
              <li key={p.name} className="card">
                <img
                  className="sprite"
                  src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`}
                  alt={p.name}
                  loading="lazy"
                />
                <span className="name">{p.name}</span>
              </li>
            );
          })}
        </ul>

        <nav className="pagination">
          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1, totalPages)}
            disabled={currentPage === 1}
          >
            Anterior
          </button>

          <div className="page-numbers">
            {visiblePageNumbers.map((page) => (
              <button
                key={page}
                className={`page-num ${page === currentPage ? "active" : ""}`}
                onClick={() => handlePageChange(page, totalPages)}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1, totalPages)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </nav>
      </main>
    </div>
  );
}

export default App;
