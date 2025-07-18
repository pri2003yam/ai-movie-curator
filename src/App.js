/* eslint-disable no-undef */ // Disables ESLint warnings for Canvas-specific variables

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged,
    signInWithCustomToken
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    deleteDoc, 
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';

// --- Helper Components & Icons ---
const Icon = ({ path, className = 'w-6 h-6' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d={path} clipRule="evenodd" />
  </svg>
);

const ICONS = {
  FILM: "M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h15a3 3 0 003-3v-9a3 3 0 00-3-3h-15zM9 12.75a.75.75 0 000-1.5h6a.75.75 0 000 1.5H9z",
  TRASH: "M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.006a.75.75 0 01-.749.654H5.88a.75.75 0 01-.749-.654L4.125 6.67a.75.75 0 01.256-1.478A48.567 48.567 0 018.25 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452z",
  SPARKLES: "M10.89 2.11a1.5 1.5 0 00-1.78 0l-1.5 1.5a1.5 1.5 0 01-2.12 0l-.38-.38a1.5 1.5 0 00-2.12 0l-1.5 1.5a1.5 1.5 0 000 2.12l.38.38a1.5 1.5 0 010 2.12l-1.5 1.5a1.5 1.5 0 000 2.12l1.5 1.5a1.5 1.5 0 010 2.12l-.38.38a1.5 1.5 0 000 2.12l1.5 1.5a1.5 1.5 0 002.12 0l.38-.38a1.5 1.5 0 012.12 0l1.5 1.5a1.5 1.5 0 002.12 0l1.5-1.5a1.5 1.5 0 010-2.12l.38-.38a1.5 1.5 0 000-2.12l1.5-1.5a1.5 1.5 0 000-2.12l-1.5-1.5a1.5 1.5 0 010-2.12l-.38-.38a1.5 1.5 0 000-2.12l-1.5-1.5a1.5 1.5 0 00-2.12 0l-.38.38a1.5 1.5 0 01-2.12 0l-1.5-1.5z",
  CHECK: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z",
  PLUS: "M12 5.25a.75.75 0 01.75.75v5.25H18a.75.75 0 010 1.5h-5.25V18a.75.75 0 01-1.5 0v-5.25H6a.75.75 0 010-1.5h5.25V6a.75.75 0 01.75-.75z",
};

const LoadingSpinner = ({ size = 'h-5 w-5' }) => (
    <svg className={`animate-spin ${size} text-white`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


// --- Main App Component ---
export default function App() {
  // --- State Management ---
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('to-watch');
  const [processingIds, setProcessingIds] = useState(new Set());

  const [movies, setMovies] = useState([]);
  const [newMovie, setNewMovie] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  
  const analysisRef = useRef(null);

  // --- Firebase Initialization and Auth ---
  useEffect(() => {
    const firebaseConfigStr = process.env.REACT_APP_FIREBASE_CONFIG || (typeof __firebase_config !== 'undefined' ? __firebase_config : null);
    
    if (!firebaseConfigStr) {
        setError("Firebase configuration is missing.");
        return;
    }
    
    try {
        const firebaseConfig = JSON.parse(firebaseConfigStr);
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);
        setAuth(authInstance);
        setDb(dbInstance);

        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            try {
                const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                if (initialAuthToken) {
                    await signInWithCustomToken(authInstance, initialAuthToken);
                } else {
                    await signInAnonymously(authInstance);
                }
            } catch (err) {
                console.error("Authentication failed:", err);
            }
          }
          setIsAuthReady(true);
        });
        return () => unsubscribe();
    } catch (e) {
        setError("Invalid Firebase configuration format.");
        console.error("Failed to parse Firebase config:", e);
    }
  }, []);

  // --- Firestore Data Fetching ---
  useEffect(() => {
    if (!isAuthReady || !db || !userId) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const moviesCollectionPath = `artifacts/${appId}/users/${userId}/movies`;
    const q = query(collection(db, moviesCollectionPath));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const moviesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      moviesData.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMovies(moviesData);
    }, (err) => {
      console.error("Error fetching movies:", err);
    });
    return () => unsubscribe();
  }, [db, userId, isAuthReady]);

  // --- OMDb API Call for Movie Details ---
  const getMovieDetails = async (movieTitle) => {
    const OMDB_API_KEY = process.env.REACT_APP_OMDB_API_KEY;

    if (!OMDB_API_KEY) {
        console.error("OMDb API key is missing.");
        return { posterUrl: null, description: "OMDb API key not configured." };
    }

    const searchUrl = `https://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&apikey=${OMDB_API_KEY}`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) throw new Error('Failed to fetch from OMDb');
    
    const data = await response.json();
    if (data.Response === "True") {
        const posterUrl = data.Poster !== "N/A" ? data.Poster : null;
        return { posterUrl, description: data.Plot };
    }
    return { posterUrl: null, description: 'No details found.' };
  };

  const triggerDetailFetch = async (movieId, movieTitle) => {
    setProcessingIds(prev => new Set(prev).add(movieId));
    try {
      const details = await getMovieDetails(movieTitle);
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const movieDocPath = `artifacts/${appId}/users/${userId}/movies/${movieId}`;
      await updateDoc(doc(db, movieDocPath), {
        description: details.description,
        posterUrl: details.posterUrl,
      });
    } catch (err) {
      console.error(`Failed to get details for ${movieTitle}:`, err);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(movieId);
        return newSet;
      });
    }
  };


  // --- Firestore Actions ---
  const handleAddMovie = async (e, title = newMovie, watched = false) => {
    if (e) e.preventDefault();
    if (!title.trim() || !db || !userId) return;

    if (movies.some(movie => movie.title.toLowerCase() === title.toLowerCase())) {
        setError(`"${title}" is already in your list.`);
        setTimeout(() => setError(null), 3000);
        return;
    }

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const moviesCollectionPath = `artifacts/${appId}/users/${userId}/movies`;
    try {
      const docRef = await addDoc(collection(db, moviesCollectionPath), { 
        title: title.trim(), 
        watched,
        createdAt: serverTimestamp() 
      });
      if (e) setNewMovie('');
      if (watched) {
        triggerDetailFetch(docRef.id, title.trim());
      }
    } catch (err) {
      console.error("Error adding movie:", err);
    }
  };

  const handleRemoveMovie = async (id) => {
    if (!db || !userId) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const movieDocPath = `artifacts/${appId}/users/${userId}/movies/${id}`;
    await deleteDoc(doc(db, movieDocPath));
  };
  
  const handleToggleWatched = async (id, movieTitle, currentStatus) => {
    if (!db || !userId) return;
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const movieDocPath = `artifacts/${appId}/users/${userId}/movies/${id}`;
    const movieIsNowWatched = !currentStatus;
    
    await updateDoc(doc(db, movieDocPath), { watched: movieIsNowWatched });

    if (movieIsNowWatched) {
        const movie = movies.find(m => m.id === id);
        if (movie && !movie.description && !movie.posterUrl) {
            triggerDetailFetch(id, movieTitle);
        }
    }
  };

  const handleAnalyzeTaste = async () => {
    const watchedMovies = movies.filter(m => m.watched);
    if (watchedMovies.length < 3) {
      setError("Please mark at least 3 movies as watched for a good analysis.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAiAnalysis(null);

    const movieList = watchedMovies.map(m => m.title).join(', ');
    const prompt = `As a film expert, analyze this list of watched movies: ${movieList}. Based on this list, generate a response in a valid JSON format. The JSON object must contain three keys: 1) 'title': a creative, personalized title for the user (e.g., 'The Action Aficionado'). 2) 'suggestion': a brief, one-sentence summary of their taste and a suggestion. 3) 'recommendations': an array of exactly 3 movie titles they might enjoy.`;

    const apiKey = process.env.REACT_APP_GEMINI_API_KEY || ""; // Use environment variable
    if (!apiKey) {
        setError("Gemini API key is not configured.");
        setIsLoading(false);
        return;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    };

    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        const resultText = data.candidates[0]?.content?.parts[0]?.text;
        if (resultText) {
            const cleanedJsonString = resultText.replace(/```json|```/g, '').trim();
            const parsedJson = JSON.parse(cleanedJsonString);
            
            const recommendationDetailsPromises = parsedJson.recommendations.map(title => 
                getMovieDetails(title).then(details => ({ title, ...details }))
            );
            const recommendationDetails = await Promise.all(recommendationDetailsPromises);

            setAiAnalysis({
                ...parsedJson,
                recommendations: recommendationDetails
            });
            setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } else {
            throw new Error('Invalid response from API.');
        }
    } catch (err) {
        console.error("Error analyzing taste:", err);
        setError('The AI curator is busy. Please try again in a moment.');
    } finally {
        setIsLoading(false);
    }
  };

  const moviesToDisplay = movies.filter(movie => activeTab === 'to-watch' ? !movie.watched : movie.watched);
  const watchedMoviesForAnalysis = movies.filter(m => m.watched);

  // --- Rendered JSX ---
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            AI Movie Curator
          </h1>
          <p className="text-gray-400 mt-2">Build your watchlist, mark what you've seen, and get personalized AI-driven recommendations.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Watchlist & Watched */}
          <div className="bg-gray-800/50 rounded-xl shadow-lg p-6 backdrop-blur-sm border border-gray-700 flex flex-col">
            <h2 className="text-2xl font-semibold mb-4 text-indigo-400">Manage Your Movies</h2>
            <form onSubmit={handleAddMovie} className="flex gap-2 mb-4">
              <input type="text" value={newMovie} onChange={(e) => setNewMovie(e.target.value)} placeholder="Add a movie title..." className="flex-grow bg-gray-700 text-white rounded-md px-4 py-2 border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition" disabled={!isAuthReady} />
              <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition">Add</button>
            </form>
            
            <div className="flex border-b border-gray-700 mb-4">
                <button onClick={() => setActiveTab('to-watch')} className={`py-2 px-4 font-semibold transition ${activeTab === 'to-watch' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400'}`}>To Watch</button>
                <button onClick={() => setActiveTab('watched')} className={`py-2 px-4 font-semibold transition ${activeTab === 'watched' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400'}`}>Watched</button>
            </div>

            <div className="flex-grow h-96 overflow-y-auto pr-2">
                {activeTab === 'to-watch' ? (
                    <div className="space-y-2">
                        {moviesToDisplay.length > 0 ? moviesToDisplay.map(movie => (
                            <div key={movie.id} className="flex items-center justify-between bg-gray-700/80 p-3 rounded-lg animate-fade-in">
                                <div className="flex items-center truncate">
                                    <input type="checkbox" checked={!!movie.watched} onChange={() => handleToggleWatched(movie.id, movie.title, movie.watched)} className="h-5 w-5 rounded bg-gray-600 border-gray-500 text-indigo-500 focus:ring-indigo-600 mr-3 cursor-pointer" />
                                    <span className="truncate">{movie.title}</span>
                                </div>
                                <button onClick={() => handleRemoveMovie(movie.id)} className="text-gray-400 hover:text-red-500 transition ml-2"><Icon path={ICONS.TRASH} className="w-5 h-5" /></button>
                            </div>
                        )) : <div className="text-center text-gray-500 pt-32">Your watchlist is empty!</div>}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {moviesToDisplay.length > 0 ? moviesToDisplay.map(movie => (
                            <div key={movie.id} className="bg-gray-700/60 rounded-lg overflow-hidden animate-fade-in group relative">
                                <div className="aspect-w-2 aspect-h-3 bg-gray-800 flex items-center justify-center">
                                    {processingIds.has(movie.id) || !movie.posterUrl ? <LoadingSpinner/> : <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover"/>}
                                </div>
                                <div className="absolute inset-0 bg-black/70 p-2 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <h4 className="font-bold text-sm">{movie.title}</h4>
                                    <p className="text-xs text-gray-300 leading-tight mt-1">{movie.description || '...'}</p>
                                </div>
                                <button onClick={() => handleToggleWatched(movie.id, movie.title, movie.watched)} className="absolute top-1 left-1 bg-indigo-600 p-1 rounded-full text-white"><Icon path={ICONS.CHECK} className="w-3 h-3"/></button>
                                <button onClick={() => handleRemoveMovie(movie.id)} className="absolute top-1 right-1 bg-red-600 p-1 rounded-full text-white"><Icon path={ICONS.TRASH} className="w-3 h-3"/></button>
                            </div>
                        )) : <div className="col-span-full text-center text-gray-500 pt-32">No movies marked as watched.</div>}
                    </div>
                )}
            </div>
            
            <button onClick={handleAnalyzeTaste} disabled={isLoading || watchedMoviesForAnalysis.length < 3} className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2">
              {isLoading ? <><LoadingSpinner /> Curating...</> : <><Icon path={ICONS.SPARKLES} className="w-5 h-5" /> Analyze My Taste</>}
            </button>
            {watchedMoviesForAnalysis.length < 3 && <p className="text-center text-xs text-gray-500 mt-2">Mark at least 3 movies as watched to enable analysis.</p>}
          </div>

          {/* Right Column: AI Analysis */}
          <div className="bg-gray-800/50 rounded-xl shadow-lg p-6 backdrop-blur-sm border border-gray-700" ref={analysisRef}>
            <h2 className="text-2xl font-semibold mb-4 text-purple-400">AI Curator's Analysis</h2>
            {error && <div className="p-3 mb-4 text-sm text-red-300 rounded-lg bg-red-900/50 border border-red-500/50">{error}</div>}
            
            {aiAnalysis ? (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-sm uppercase text-gray-400 font-semibold">Your Profile</h3>
                  <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-400">{aiAnalysis.title}</p>
                </div>
                <div>
                  <h3 className="text-sm uppercase text-gray-400 font-semibold">Curator's Note</h3>
                  <p className="text-gray-300 italic">"{aiAnalysis.suggestion}"</p>
                </div>
                <div>
                  <h3 className="text-sm uppercase text-gray-400 font-semibold">You Might Also Like...</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    {Array.isArray(aiAnalysis.recommendations) && aiAnalysis.recommendations.map((rec, index) => (
                      <div key={index} className="bg-gray-700/60 rounded-lg overflow-hidden">
                        <div className="aspect-w-2 aspect-h-3 bg-gray-800 flex items-center justify-center">
                            {rec.posterUrl ? <img src={rec.posterUrl} alt={rec.title} className="w-full h-full object-cover"/> : <Icon path={ICONS.FILM} className="w-12 h-12 text-gray-600"/>}
                        </div>
                        <div className="p-3">
                            <h4 className="font-bold text-white truncate">{rec.title}</h4>
                            <p className="text-xs text-gray-400 h-16 overflow-hidden mt-1">{rec.description}</p>
                            <div className="flex gap-2 mt-3">
                                <button onClick={() => handleAddMovie(null, rec.title, true)} className="flex-1 text-xs bg-green-600 text-white font-semibold py-2 px-2 rounded-md hover:bg-green-500 transition flex items-center justify-center gap-1">
                                    <Icon path={ICONS.CHECK} className="w-4 h-4"/> Watched
                                </button>
                                <button onClick={() => handleAddMovie(null, rec.title, false)} className="flex-1 text-xs bg-indigo-600 text-white font-semibold py-2 px-2 rounded-md hover:bg-indigo-500 transition flex items-center justify-center gap-1">
                                    <Icon path={ICONS.PLUS} className="w-4 h-4"/> Add to List
                                </button>
                            </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <Icon path={ICONS.SPARKLES} className="w-16 h-16 opacity-20 mb-4" />
                <p>Your personalized analysis will appear here once you analyze your watchlist.</p>
              </div>
            )}
          </div>
        </div>
        <footer className="text-center text-gray-600 mt-8 text-sm">
            {userId && <p>Session ID: {userId}</p>}
            <p>Powered by Gemini & OMDb API</p>
        </footer>
      </div>
    </div>
  );
}

// Add some basic CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fade-in 0.5s ease-out forwards;
  }
  /* For aspect ratio box */
  .aspect-w-2 { position: relative; padding-bottom: 150%; }
  .aspect-h-3 { height: 0; }
  .aspect-w-2 > * { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
`;
document.head.append(style);
