// ReceptionDashboard.jsx
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

export default function ReceptionDashboard() {
  const [allGuests, setAllGuests] = useState([]); // Store the unfiltered, original list
  const [total, setTotal] = useState(0);
  const [attended, setAttended] = useState(0);
  const [notAttended, setNotAttended] = useState(0);
  
  // State for filtering and searching
  const [filterType, setFilterType] = useState({ 
    key: 'TOTAL', 
    title: 'Total Guests' 
  }); 
  const [searchTerm, setSearchTerm] = useState(''); 

  const scannerRef = useRef(null);

  // Function to get the JWT token for API authorization
  const getToken = () => localStorage.getItem('token');
  const API_URL = "http://192.168.1.147:5000/api/guests";

  const fetchGuests = async () => {
    const token = getToken();
    if (!token) return; // Should handle redirect to login if no token

    try {
      const res = await axios.get(API_URL, {
          headers: {
            Authorization: `Bearer ${token}` // Pass token for authentication
          }
      });
      const guestsData = res.data.guests;
      
      setAllGuests(guestsData); 

      // Calculate statistics
      setTotal(guestsData.length);
      const attendedCount = guestsData.filter(g => g.attendance_checked).length;
      setAttended(attendedCount);
      setNotAttended(guestsData.length - attendedCount);

    } catch (err) {
      console.error("Failed to fetch guests:", err);
      // Handle 401/403 errors (e.g., redirect to login)
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
    const token = getToken();
    if (!token) {
        alert("Authentication required. Please log in.");
        return;
    }
    
    // The QR code contains text with 'Guest ID: [id]'. We need to extract the number.
    const guestIdMatch = data.match(/Guest ID:\s*(\d+)/);
    if (!guestIdMatch) {
        // Fallback for codes that might just be the ID number
        const fallbackIdMatch = data.match(/^\s*(\d+)\s*$/);
        if (!fallbackIdMatch) {
            alert("❌ Invalid QR Code data format. Cannot find Guest ID.");
            return;
        }
    }
    const guestId = guestIdMatch ? parseInt(guestIdMatch[1], 10) : parseInt(data.replace(/\D/g, ""), 10);
    

    try {
      // Send the guest ID to the protected scan endpoint
      const res = await axios.post(`${API_URL}/scan`, { guestId }, {
        // headers: {
        //     Authorization: `Bearer ${token}` // Pass token for check-in
        // }
      });

      // ✅ SUCCESS ALERT
      // new Audio("/beep-success.mp3").play(); // Uncomment if you have this file
      alert(
        `✅ Guest Checked In!\nName: ${res.data.guest.fullname}\nPhone: ${res.data.guest.phonenumber}`
      );
      
      // Re-fetch all guests to update the list and stats
      fetchGuests(); 
    } catch (err) {
      // ❌ ERROR ALERT
      // new Audio("/beep-error.mp3").play(); // Uncomment if you have this file
      alert(err.response?.data?.message || "❌ Scan failed / already scanned");
    }
    
    // Rerender the scanner after a delay to ensure it restarts smoothly
    setTimeout(() => {
        if (!scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                "qr-reader",
                { fps: 10, qrbox: 250 },
                false
            );
            scanner.render(
                async (decodedText, decodedResult) => {
                    if (scannerRef.current) {
                        scannerRef.current.clear(); 
                        scannerRef.current = null;
                    }
                    await handleScan(decodedText);
                },
                (errorMessage) => {}
            );
            scannerRef.current = scanner;
        }
    }, 1000);
  };
  
  // Memoized function to filter and search the guest list
  const filteredGuests = useMemo(() => {
    const filterKey = filterType.key;
    
    return allGuests.filter(guest => {
      // 1. Filter by Category
      const statusMatch = (
        filterKey === 'TOTAL' ||
        (filterKey === 'ATTENDED' && guest.attendance_checked) ||
        (filterKey === 'NOT_ATTENDED' && !guest.attendance_checked)
      );

      // 2. Filter by Search Term (Phone Number)
      const searchLower = searchTerm.toLowerCase();
      const phoneMatch = guest.phonenumber 
        ? guest.phonenumber.toLowerCase().includes(searchLower) 
        : true;
      
      const nameMatch = guest.fullname
        ? guest.fullname.toLowerCase().includes(searchLower)
        : true;

      return statusMatch && (phoneMatch || nameMatch);
    }).sort((a, b) => {
        // Sort attended first (Attended = -1, Not Attended = 1)
        if (a.attendance_checked !== b.attendance_checked) {
            return a.attendance_checked ? -1 : 1;
        }
        // Then by full name
        return a.fullname?.localeCompare(b.fullname || '') || 0;
    });
  }, [allGuests, filterType.key, searchTerm]);


  // Helper component for the status cards
  const StatCard = ({ title, count, type }) => {
    const isActive = filterType.key === type;
    
    // Determine the color classes for the card
    const cardClasses = `p-4 rounded-xl shadow-lg text-center cursor-pointer 
        transform transition duration-300 ${NAVY_THEME.primaryHover} 
        ${isActive 
            ? `${NAVY_THEME.primary} text-white shadow-blue-500/50 scale-[1.02]` // Active style
            : `${NAVY_THEME.cardBg} ${NAVY_THEME.textColor}` // Default style
        }`;
    
    const countClasses = `text-3xl mt-2 font-extrabold ${isActive ? 'text-white' : 'text-blue-600'}`;
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
        Reception Dashboard
      </h1>

      {/* Stats Cards (Filter Controls) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Guests" count={total} type="TOTAL" />
        <StatCard title="Attended Guests" count={attended} type="ATTENDED" />
        <StatCard title="Not Attended" count={notAttended} type="NOT_ATTENDED" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* QR Scanner Section (Column 1) */}
        <div className="lg:col-span-1">
          <div className={`${NAVY_THEME.cardBg} p-6 rounded-xl shadow-2xl sticky top-6`}>
            <h2 className="text-2xl font-bold mb-4 text-blue-800">QR Scanner</h2>
            <div id="qr-reader" className="w-full"></div>
            <p className="mt-4 text-sm text-gray-500 text-center">Scan QR Code to Check-In Guest</p>
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
              type="text" // Changed from tel to text for searching names too
              placeholder="Search by Name or Phone Number..."
              className="w-full p-3 mb-6 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500 transition duration-150"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* List Header */}
            <div className={`grid grid-cols-5 p-3 font-semibold text-sm rounded-t-lg ${NAVY_THEME.primary} text-white`}>
                <div className="col-span-3">Guest Name / Phone</div>
                <div className="col-span-1 text-center">Status</div>
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
                                {guest.attendance_checked ? (
                                    <span className="inline-block px-3 py-1 text-xs font-semibold leading-none rounded-full bg-green-100 text-green-800">
                                        Attended
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