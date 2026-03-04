import React, { useEffect, useState } from "react";
import aura from "aura-http";

type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await aura.get<Todo[]>(
          "https://jsonplaceholder.typicode.com/todos?_limit=5",
          {
            timeout: 8000
          }
        );
        setTodos(res.data);
      } catch (err: any) {
        setError(err?.message ?? "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, #1f2937, #020617 55%, #000000)",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "1.5rem"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "640px",
          borderRadius: "1rem",
          background:
            "linear-gradient(145deg, rgba(15,23,42,0.95), rgba(30,64,175,0.9))",
          boxShadow:
            "0 25px 50px -12px rgba(15,23,42,0.75), 0 0 0 1px rgba(148,163,184,0.08)",
          padding: "1.75rem 1.75rem 1.5rem"
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem"
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                margin: 0
              }}
            >
              Aura HTTP Demo
            </h1>
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.9rem",
                color: "#cbd5f5"
              }}
            >
              Fetching todos via a modern fetch-based client.
            </p>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              border: "1px solid rgba(129,140,248,0.5)",
              color: "#a5b4fc",
              background: "rgba(15,23,42,0.85)",
              textTransform: "uppercase",
              letterSpacing: "0.08em"
            }}
          >
            aura-http
          </span>
        </header>

        <main>
          {loading && (
            <p
              style={{
                fontSize: "0.9rem",
                color: "#c7d2fe",
                margin: "0.5rem 0 0.75rem"
              }}
            >
              Loading todos...
            </p>
          )}

          {error && (
            <div
              style={{
                marginBottom: "0.75rem",
                borderRadius: "0.75rem",
                padding: "0.75rem 0.9rem",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(248,113,113,0.45)",
                color: "#fecaca",
                fontSize: "0.85rem"
              }}
            >
              <strong style={{ fontWeight: 600 }}>Error: </strong>
              {error}
            </div>
          )}

          <section
            style={{
              borderRadius: "0.9rem",
              background: "rgba(15,23,42,0.85)",
              border: "1px solid rgba(148,163,184,0.25)",
              padding: "0.9rem 0.9rem 0.5rem",
              maxHeight: "320px",
              overflow: "auto"
            }}
          >
            {!loading && !error && !todos && (
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#9ca3af",
                  margin: 0
                }}
              >
                No data yet.
              </p>
            )}

            {todos &&
              todos.map(todo => (
                <article
                  key={todo.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.6rem",
                    padding: "0.6rem 0.45rem",
                    borderRadius: "0.6rem",
                    transition: "background 120ms ease",
                    background: todo.completed
                      ? "rgba(22,163,74,0.12)"
                      : "transparent"
                  }}
                >
                  <span
                    style={{
                      width: "0.5rem",
                      height: "0.5rem",
                      marginTop: "0.3rem",
                      borderRadius: "999px",
                      background: todo.completed ? "#22c55e" : "#f97316",
                      boxShadow: todo.completed
                        ? "0 0 0 4px rgba(34,197,94,0.25)"
                        : "0 0 0 4px rgba(249,115,22,0.25)"
                    }}
                  />
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "0.95rem",
                        fontWeight: 500,
                        color: "#e5e7eb"
                      }}
                    >
                      {todo.title}
                    </h2>
                    <p
                      style={{
                        margin: "0.18rem 0 0",
                        fontSize: "0.8rem",
                        color: "#9ca3af"
                      }}
                    >
                      #{todo.id} • user {todo.userId}
                    </p>
                  </div>
                </article>
              ))}
          </section>
        </main>

        <footer
          style={{
            marginTop: "0.9rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.75rem",
            color: "#9ca3af"
          }}
        >
          <span>Built with fetch & AbortSignal.timeout.</span>
          <span style={{ opacity: 0.8 }}>Try editing `demo/src/App.tsx`.</span>
        </footer>
      </div>
    </div>
  );
};

