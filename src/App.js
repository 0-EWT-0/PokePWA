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

  const sendLocalNotification = async (name, id) => {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta la Notification API.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Debes permitir notificaciones para continuar.");
      return;
    }

    // Fallback sin SW (por si acaso)
    if (!("serviceWorker" in navigator)) {
      new Notification(`¡Pokémon: ${name}!`, {
        body: "¡Tienes que atraparlo!",
        icon: id
          ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
          : undefined,
      });
      return;
    }

    const reg = await navigator.serviceWorker.ready;

    const payload = {
      type: "SHOW_NOTIFICATION",
      title: `¡Pokémon: ${name}!`,
      body: "¡Tienes que atraparlo!",
      url: "/", // cámbialo si quieres abrir otra ruta
      icon: id
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
        : "/icons/icon-192.png",
      // image: id ? `...` : undefined, // si quieres una imagen grande
      tag: `poke-${name}`, // evita duplicados
    };

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(payload);
    } else if (reg && reg.active) {
      reg.active.postMessage(payload);
    } else {
      console.warn("No hay SW activo para recibir el mensaje.");
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

        <ul
          className="grid"
          onClick={(e) => {
            // delegación de eventos: buscamos el botón más cercano con data-poke-*
            const target = e.target;
            const btn = target.closest("[data-poke-name]");
            if (!btn) return;

            e.preventDefault();
            e.stopPropagation();

            const name = btn.getAttribute("data-poke-name");
            const id = btn.getAttribute("data-poke-id");

            console.log("[UI] click/tap en tarjeta (delegado):", name, id);
            sendLocalNotification(name, id);
          }}
        >
          {visibleList.map((p) => {
            const id = getIdFromUrl(p.url);
            const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

            return (
              <li key={p.name} className="card">
                {/* Botón “inerte” que solo provee los data- atributos; el click real lo maneja el UL */}
                <button
                  type="button"
                  className="card-btn"
                  data-poke-name={p.name}
                  data-poke-id={id}
                  // Importante: no pongas onClick aquí para evitar duplicados
                  aria-label={`Enviar notificación de ${p.name}`}
                >
                  <img
                    className="sprite"
                    src={sprite}
                    alt={p.name}
                    loading="lazy"
                  />
                  <span className="name">{p.name}</span>
                </button>
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
