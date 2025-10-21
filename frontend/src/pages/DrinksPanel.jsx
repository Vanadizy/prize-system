import { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import { Html5QrcodeScanner } from "html5-qrcode";
 
// Define the base styles for the navy theme
const NAVY_THEME = {
  // Main background color for the page
  pageBg: "bg-gray-100", 
  // Primary color for titles, buttons, and active states
  primary: "bg-blue-800", 
  // Hover color for interactive elements
  primaryHover: "hover:bg-blue-700", 
  // Card background
  cardBg: "bg-white", 
  // Text color for details
  textColor: "text-gray-700",
};

export default function DrinksDashboard() { // Renamed component
  const [allGuests, setAllGuests] = useState([]); 
  const [totalAttended, setTotalAttended] = useState(0); // Total Guests who have attended
  const [gotDrinks, setGotDrinks] = useState(0);       // Attended Guests who got drinks
  const [noDrinks, setNoDrinks] = useState(0);         // Attended Guests who have NOT gotten drinks
  
  // State for filtering and searching
  const [filterType, setFilterType] = useState({ 
    key: 'ATTENDED', // Default filter is ATTENDED (All Guests at the venue)
    title: 'Attended Guests' 
  }); 
  const [searchTerm, setSearchTerm] = useState(''); 

  const scannerRef = useRef(null);

  // NOTE: Assuming the backend serves the same guest list, but the purpose of scan is different
  const API_URL = "https://guestsystem.onrender.com/api/guests";
  const DRINKS_SCAN_URL = "https://guestsystem.onrender.com/api/drinks/scan"; 
  // IMPORTANT: You will need to create this /api/drinks/scan endpoint in your Node.js backend!

  const fetchGuests = async () => {
    try {
      // Fetch the full guest list
      const res = await axios.get(API_URL);
      const guestsData = res.data.guests;
      
      // Filter only guests who have attended (relevant for drinks station)
      const attendedGuests = guestsData.filter(g => g.attendance_checked);
      setAllGuests(attendedGuests); 

      // Calculate statistics based on ATTENDED guests
      setTotalAttended(attendedGuests.length);
      const drinksReceivedCount = attendedGuests.filter(g => g.drinks_received).length;
      setGotDrinks(drinksReceivedCount);
      setNoDrinks(attendedGuests.length - drinksReceivedCount);

    } catch (err) {
      console.error("Failed to fetch guests:", err);
    }
  };

  useEffect(() => {
    fetchGuests();

    // Initialize HTML5 QR Code Scanner
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: 250 },
      false
    );
    scanner.render(
      async (decodedText, decodedResult) => {
        // Stop scanning to prevent multiple calls
        if (scannerRef.current) {
             scannerRef.current.clear(); 
             scannerRef.current = null;
        }
        await handleScan(decodedText);
      },
      (errorMessage) => {
        // ignore scan failures
      }
    );
    scannerRef.current = scanner;

    // Cleanup: Clear the scanner when the component unmounts
    return () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(e => console.error("Error clearing scanner", e));
        }
    };
  }, []); 

  const handleScan = async (data) => {
    if (!data) return;
    try {
      // Extract guestId from QR 
      const guestId = parseInt(data.replace(/\D/g, ""), 10);
      
      // IMPORTANT: Use the dedicated DRINKS_SCAN_URL
      const res = await axios.post(DRINKS_SCAN_URL, { guestId });

      new Audio("/beep-success.mp3").play();
      alert(
        `✅ Drink Served!\nName: ${res.data.guest.fullname}\nPhone: ${res.data.guest.phonenumber}`
      );
      
      // Re-fetch all guests to update the list and stats
      fetchGuests(); 
    } catch (err) {
      new Audio("/beep-error.mp3").play();
      alert(err.response?.data?.message || "❌ Scan failed / Drink already served");
    }
  };
  
  // Memoized function to filter and search the guest list
  const filteredGuests = useMemo(() => {
    const filterKey = filterType.key;
    
    return allGuests.filter(guest => {
      // 1. Filter by Category (Drinks Status)
      const statusMatch = (
        filterKey === 'ATTENDED' || // Show ALL attended guests
        (filterKey === 'GOT_DRINKS' && guest.drinks_received) ||
        (filterKey === 'NO_DRINKS' && !guest.drinks_received)
      );

      // 2. Filter by Search Term (Phone Number)
      const phoneMatch = guest.phonenumber 
        ? guest.phonenumber.includes(searchTerm) 
        : true; 

      return statusMatch && phoneMatch;
    }).sort((a, b) => {
        // Sort NO_DRINKS (Pending) first
        if (a.drinks_received !== b.drinks_received) {
            return a.drinks_received ? 1 : -1;
        }
        // Then by full name
        return a.fullname?.localeCompare(b.fullname || '') || 0;
    });
  }, [allGuests, filterType.key, searchTerm]);


  // Helper component for the status cards
  const StatCard = ({ title, count, type, colorClasses }) => {
    const isActive = filterType.key === type;
    
    // Determine the color classes for the card
    const cardClasses = `p-4 rounded-xl shadow-lg text-center cursor-pointer 
        transform transition duration-300 ${NAVY_THEME.primaryHover} 
        ${isActive 
            ? `${NAVY_THEME.primary} text-white shadow-blue-500/50 scale-[1.02]` // Active style
            : `${NAVY_THEME.cardBg} ${NAVY_THEME.textColor}` // Default style
        }`;
    
    const countClasses = `text-3xl mt-2 font-extrabold ${isActive ? 'text-white' : colorClasses}`;
    const titleClasses = `text-xl font-semibold ${isActive ? 'text-blue-100' : 'text-blue-800'}`;

    const handleClick = () => {
        setFilterType({ key: type, title: title });
        setSearchTerm(''); // Clear search when filter changes
    };

    return (
      <div 
        className={cardClasses}
        onClick={handleClick}
      >
        <h2 className={titleClasses}>{title}</h2>
        <p className={countClasses}>
            {count}
        </p>
      </div>
    );
  };
  

  return (
    <div className={`p-6 font-sans ${NAVY_THEME.pageBg} min-h-screen`}>
      <h1 className="text-4xl font-extrabold mb-8 text-blue-800 border-b pb-2 border-blue-200">
        Drinks Station Dashboard
      </h1>

      {/* Stats Cards (Filter Controls) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Attended Guests" count={totalAttended} type="ATTENDED" colorClasses="text-blue-600" />
        <StatCard title="Got Drinks" count={gotDrinks} type="GOT_DRINKS" colorClasses="text-green-600" />
        <StatCard title="No Drinks Yet" count={noDrinks} type="NO_DRINKS" colorClasses="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* QR Scanner Section (Column 1) */}
        <div className="lg:col-span-1">
          <div className={`${NAVY_THEME.cardBg} p-6 rounded-xl shadow-2xl sticky top-6`}>
            <h2 className="text-2xl font-bold mb-4 text-blue-800">Serve Drink Scanner</h2>
            <div id="qr-reader" className="w-full"></div>
            <p className="mt-4 text-sm text-gray-500 text-center">Scan QR Code to Mark Drink as Served</p>
          </div>
        </div>

        {/* Guest List Section (Columns 2 & 3) */}
        <div className="lg:col-span-2">
          <div className={`${NAVY_THEME.cardBg} p-6 rounded-xl shadow-2xl`}>
            {/* Dynamic Table Title */}
            <h2 className="text-2xl font-bold mb-4 text-blue-800">
              {filterType.title} List ({filteredGuests.length})
            </h2>

            {/* Search Input */}
            <input
              type="tel"
              placeholder="Search by Phone Number..."
              className="w-full p-3 mb-6 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500 transition duration-150"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* List Header */}
            <div className={`grid grid-cols-5 p-3 font-semibold text-sm rounded-t-lg ${NAVY_THEME.primary} text-white`}>
                <div className="col-span-3">Guest Name / Phone</div>
                <div className="col-span-1 text-center">Drink Status</div>
                <div className="col-span-1 text-center">ID</div>
            </div>

            {/* Guest List Items */}
            <div className="h-[500px] overflow-y-auto border border-gray-200 rounded-b-lg">
                {filteredGuests.length > 0 ? (
                    filteredGuests.map((guest, index) => (
                        <div
                            key={guest.id}
                            className={`grid grid-cols-5 p-3 border-b border-gray-100 items-center transition duration-100 ${
                                index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                            } hover:bg-blue-50`}
                        >
                            <div className="col-span-3">
                                <p className="font-medium text-gray-800">{guest.fullname}</p>
                                <p className="text-xs text-gray-500">{guest.phonenumber}</p>
                            </div>
                            <div className="col-span-1 text-center">
                                {guest.drinks_checked ? (
                                    <span className="inline-block px-3 py-1 text-xs font-semibold leading-none rounded-full bg-green-100 text-green-800">
                                        Served
                                    </span>
                                ) : (
                                    <span className="inline-block px-3 py-1 text-xs font-semibold leading-none rounded-full bg-red-100 text-red-800">
                                        Pending
                                    </span>
                                )}
                            </div>
                            <div className="col-span-1 text-center text-sm text-gray-500">{guest.id}</div>
                        </div>
                    ))
                ) : (
                    <div className="p-10 text-center text-gray-500">No guests match the current filter/search criteria.</div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}