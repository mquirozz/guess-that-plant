const DEFAULT_PLANTS = [
  "Claytonia lanceolata",
  "Perideridia gairdneri",
  "Achillea millefolium",
  "Triteleia grandiflora",
  "Crepis tectorum",
  "Berberis repens",
  "Penstemon procerus",
  "Koeleria macrantha",
  "Geum triflorum",
  "Helianthella uniflora",
];

// Photos to include per plant (More photos, slower to load).
const PHOTOS_PER_PLANT = 5;

// Observations pulled from iNaturalist before randomly picking photos.
const POOL_SIZE = 40;

// Root URL for the iNaturalist API
const API = "https://api.inaturalist.org/v1";

let deck          = [];     // array of card objects built by startFetch()
let currentCard   = 0;      // index into deck[] of the card being shown
let cardIsFlipped = false;  // true when the name side is facing the user


/**
 * findPlant(name)
 * Search iNaturalist for a species.
 * Returns the taxon object, or null if nothing found.
 */
async function findPlant(name) {
  // Build the search URL with the plant name as the query string
  const url = `${API}/taxa?q=${encodeURIComponent(name)}&rank=species&per_page=1&order_by=observations_count`;

  const response = await fetch(url);
  const data     = await response.json();

  // results is an array; return the first item, or null if empty
  return (data.results || [])[0] || null;
}

/**
 * getPhotos(taxonId)
 * Retrieves 'research-grade' observations for a given taxon ID,
 * then return a randomly-shuffled subset of PHOTOS_PER_PLANT photos.
 * Each photo is { url, attribution }.
 */
async function getPhotos(taxonId) {
  // Gets a pool of observations that have photos, sorted by community votes
  const url = `${API}/observations?taxon_id=${taxonId}&quality_grade=research&photos=true&per_page=${POOL_SIZE}&order_by=votes`;

  const response = await fetch(url);
  const data     = await response.json();

  // Photos from all observations turn into one list
  const allPhotos = [];
  for (const obs of (data.results || [])) {
    for (const photo of (obs.photos || [])) {
      // Returns "medium" image, instead of small thumbnails.
      const photoUrl = (photo.url || "").replace("square", "medium");
      if (photoUrl) {
        allPhotos.push({
          url:         photoUrl,
          attribution: photo.attribution || "© iNaturalist"
        });
      }
    }
  }

  // Shuffle so we get different photos each run
  allPhotos.sort(() => Math.random() - 0.5);

  // Return only as many photos as configured
  return allPhotos.slice(0, PHOTOS_PER_PLANT);
}


/**
 * startFetch()
 * Called when the user clicks "Fetch & Build Deck".
 * Reads the plant list, fetches data for each plant, and
 * turns the results into card objects stored in deck[].
 */
async function startFetch() {
  // Read plant names from the textarea; one per line, skip blanks
  const plantNames = document.getElementById("plant-list").value
    .split("\n")
    .map(n => n.trim())
    .filter(n => n.length > 0);

  if (plantNames.length === 0) {
    showError("Please enter at least one plant name.");
    return;
  }

  // Reset the UI: hide the old deck and errors, show the loading message
  document.getElementById("deck").classList.remove("visible");
  document.getElementById("error").classList.remove("visible");
  document.getElementById("loading").classList.add("visible");
  document.getElementById("settings").removeAttribute("open"); // collapse panel

  const cards  = [];  // Successfully built cards
  const failed = [];  // Unsuccessfully built cards (names that couldn't load)

  // Loop through each plant and fetch its iNaturalist data
  for (let i = 0; i < plantNames.length; i++) {
    const name = plantNames[i];

    try {
      // Look up the plant and get its taxon ID
      const taxon = await findPlant(name);
      if (!taxon) {
        failed.push(`"${name}" — not found on iNaturalist`);
        continue;  // skip to the next plant
      }

      // Get photos for that taxon
      const photos = await getPhotos(taxon.id);
      if (photos.length === 0) {
        failed.push(`"${name}" — no photos available`);
        continue;
      }

      // Title-case the common name
      const commonName = (taxon.preferred_common_name || name)
        .replace(/\b\w/g, c => c.toUpperCase());

      // Create one card object per photo
      for (const photo of photos) {
        cards.push({
          commonName:  commonName,
          sciName:     taxon.name,
          photoUrl:    photo.url,
          attribution: photo.attribution
        });
      }

    } catch (err) {
      // Network error or unexpected API response
      failed.push(`"${name}" — error: ${err.message}`);
    }
  }

  // Hide the loading message once deck has been created
  document.getElementById("loading").classList.remove("visible");

  // If some plants failed, show a warning (continue with the ones that worked)
  if (failed.length > 0) {
    showError("Some plants couldn't load:<br>• " + failed.join("<br>• "));
  }

  // If nothing worked at all, stop here
  if (cards.length === 0) {
    showError("Whomp, whomp! No cards were created :( Check the plant names and try again.");
    return;
  }

  // Shuffle cards
  cards.sort(() => Math.random() - 0.5);

  // Store the deck in state and show the first card
  deck          = cards;
  currentCard   = 0;
  cardIsFlipped = false;

  document.getElementById("deck").classList.add("visible");
  showCard(0);
}


/**
 * showCard(index)
 * Fill the card elements with data from deck[index] and updates progress bar
 */
function showCard(index) {
  const c = deck[index];

  // Fill the front (photo)
  document.getElementById("card-photo").src          = c.photoUrl;
  document.getElementById("card-attribution").textContent = c.attribution;

  // Fill the back (name)
  document.getElementById("card-common-name").textContent = c.commonName;
  document.getElementById("card-sci-name").textContent    = c.sciName;

  // Update "Card N of total" label and the green progress fill
  const cardNumber = index + 1;
  document.getElementById("progress-label").textContent =
    `Card ${cardNumber} of ${deck.length}`;
  document.getElementById("progress-fill").style.width =
    `${(cardNumber / deck.length) * 100}%`;

  // Disables ← button on card 1, and → button on the last card
  document.getElementById("btn-prev").disabled = (index === 0);
  document.getElementById("btn-next").disabled = (index === deck.length - 1);
}

/**
 * flipCard()
 * Toggle between photo and name.
 */
function flipCard() {
  cardIsFlipped = !cardIsFlipped;   // toggle the flag
  document.getElementById("card").classList.toggle("flipped", cardIsFlipped);
}

/**
 * nextCard()
 * Advance to the next card, always starting on photo.
 */
function nextCard() {
  if (currentCard < deck.length - 1) {
    currentCard++;
    cardIsFlipped = false;
    document.getElementById("card").classList.remove("flipped");
    showCard(currentCard);
  }
}

/**
 * prevCard()
 * Go back to the previous card, always starting on photo.
 */
function prevCard() {
  if (currentCard > 0) {
    currentCard--;
    cardIsFlipped = false;
    document.getElementById("card").classList.remove("flipped");
    showCard(currentCard);
  }
}

/**
 * shuffleDeck()
 * Shuffle deck and start on card 1.
 */
function shuffleDeck() {
  deck.sort(() => Math.random() - 0.5);
  currentCard   = 0;
  cardIsFlipped = false;
  document.getElementById("card").classList.remove("flipped");
  showCard(0);
}

/**
 * showError(message)
 * Display an error message in the red error box.
 */
function showError(message) {
  const box = document.getElementById("error");
  box.innerHTML = message;
  box.classList.add("visible");
}


document.addEventListener("keydown", function (event) {
  // No shortcuts while user is typing in textarea
  if (document.activeElement.tagName === "TEXTAREA") return;

  if (event.key === "ArrowLeft")                 prevCard();
  if (event.key === "ArrowRight")                nextCard();
  if (event.key === " ")  { event.preventDefault(); flipCard(); }
  if (event.key === "s" || event.key === "S")    shuffleDeck();
});


// Populate textarea with default plant list
document.getElementById("plant-list").value = DEFAULT_PLANTS.join("\n");

// Automatically retrieve default plants so the page isn't blank on load
startFetch();
