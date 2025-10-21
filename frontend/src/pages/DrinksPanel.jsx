import { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import { Html5QrcodeScanner } from "html5-qrcode";

// Define the base styles for the navy theme
const NAVY_THEME = {
  pageBg: "bg-gray-100",
  primary: "bg-blue-800",
  primaryHover: "hover:bg-blue-700",
  cardBg: "bg-white",
  textColor: "text-gray-700",
};

export default function DrinksDashboard() {
  const [allGuests, setAllGuests] = useState([]);
  const [totalAttended, setTotalAttended] = useState(0);
  const [gotDrinks, setGotDrinks] = useState(0);
  const [noDrinks, setNoDrinks] = useState(0);

  const [filterType, setFilterType] = useState({
    key: "ATTENDED",
    title: "Attended Guests",
  });
  const [searchTerm, setSearchTerm] = useState("");

  const scannerRef = useRef(null);

  const API_URL = "https://guestsystem.onrender.com/api/guests";
  const DRINKS_SCAN_URL = "https://guestsystem.onrender.com/api/drinks/scan";

  // Fetch guests and calculate stats
  const fetchGuests = async () => {
    try {
      const res = await axios.get(API_URL);
      const guestsData = res.data.guests;

      // Filter only attended guests and map drinks_checked to drinks_received
      const attendedGuests = guestsData
        .filter((g) => g.attendance_checked)
        .map((g) => ({ ...g, drinks_received: g.drinks_checked }));

      setAllGuests(attendedGuests);

      // Calculate statistics
      setTotalAttended(attendedGuests.length);
      const drinksReceivedCount = attendedGuests.filter(
        (g) => g.drinks_received
      ).length;
      setGotDrinks(drinksReceivedCount);
      setNoDrinks(attendedGuests.length - drinksReceivedCount);
    } catch (err) {
      console.error("Failed to fetch guests:", err);
    }
  };

  // Initialize QR scanner
  useEffect(() => {
    fetchGuests();

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      async (decodedText) => {
        if (scannerRef.current) {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
        await handleScan(decodedText);
      },
      (errorMessage) => {}
    );

    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((e) => console.error(e));
      }
    };
  }, []);

  // Handle scan and mark drinks as served
  const handleScan = async (data) => {
    if (!data) return;
    try {
      const guestId = parseInt(data.replace(/\D/g, ""), 10);
      const res = await axios.post(DRINKS_SCAN_URL, { guestId });

      new Audio("/beep-success.mp3").play();
      alert(
        `✅ Drink Served!\nName: ${res.data.guest.fullname}\nPhone: ${res.data.guest.phonenumber}\n\nCard State: ${res.data.guest.state}`
      );

      fetchGuests();
    } catch (err) {
      new Audio("/beep-error.mp3").play();
      alert(err.response?.data?.message || "❌ Scan failed / Drink already served");
    }

        // Restart scanner after 1s
    setTimeout(() => {
      if (!scannerRef.current) {
        const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 }, false);
        scanner.render(
          async (decodedText) => {
            if (scannerRef.current) {
              scannerRef.current.clear();
              scannerRef.current = null;
            }
            await handleScan(decodedText);
          },
          () => {}
        );
        scannerRef.current = scanner;
      }
    }, 1000);




  };

  

  // Filter guests based on stats and search
  const filteredGuests = useMemo(() => {
    return allGuests
      .filter((guest) => {
        const statusMatch =
          filterType.key === "ATTENDED" ||
          (filterType.key === "GOT_DRINKS" && guest.drinks_received) ||
          (filterType.key === "NO_DRINKS" && !guest.drinks_received);

        const searchLower = searchTerm.toLowerCase();
        const nameMatch = guest.fullname
          ? guest.fullname.toLowerCase().includes(searchLower)
          : true;
        const phoneMatch = guest.phonenumber
          ? guest.phonenumber.toLowerCase().includes(searchLower)
          : true;

        return statusMatch && (nameMatch || phoneMatch);
      })
      .sort((a, b) => {
        if (a.drinks_received !== b.drinks_received) {
          return a.drinks_received ? 1 : -1;
        }
        return a.fullname?.localeCompare(b.fullname || "") || 0;
      });
  }, [allGuests, filterType.key, searchTerm]);

  // Status card component
  const StatCard = ({ title, count, type, colorClasses }) => {
    const isActive = filterType.key === type;

    const cardClasses = `p-4 rounded-xl shadow-lg text-center cursor-pointer 
        transform transition duration-300 ${NAVY_THEME.primaryHover} 
        ${isActive ? `${NAVY_THEME.primary} text-white shadow-blue-500/50 scale-[1.02]`
          : `${NAVY_THEME.cardBg} ${NAVY_THEME.textColor}`}`;

    const countClasses = `text-3xl mt-2 font-extrabold ${
      isActive ? "text-white" : colorClasses
    }`;
    const titleClasses = `text-xl font-semibold ${
      isActive ? "text-blue-100" : "text-blue-800"
    }`;

    const handleClick = () => {
      setFilterType({ key: type, title: title });
      setSearchTerm("");
    };

    return (
      <div className={cardClasses} onClick={handleClick}>
        <h2 className={titleClasses}>{title}</h2>
        <p className={countClasses}>{count}</p>
      </div>
    );
  };

  return (
    <div className={`p-6 font-sans ${NAVY_THEME.pageBg} min-h-screen`}>
      <h1 className="text-4xl font-extrabold mb-8 text-blue-800 border-b pb-2 border-blue-200">
        Drinks Station Dashboard
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Attended Guests" count={totalAttended} type="ATTENDED" colorClasses="text-blue-600" />
        <StatCard title="Got Drinks" count={gotDrinks} type="GOT_DRINKS" colorClasses="text-green-600" />
        <StatCard title="No Drinks Yet" count={noDrinks} type="NO_DRINKS" colorClasses="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* QR Scanner */}
        <div className="lg:col-span-1">
          <div className={`${NAVY_THEME.cardBg} p-6 rounded-xl shadow-2xl sticky top-6`}>
            <h2 className="text-2xl font-bold mb-4 text-blue-800">Serve Drink Scanner</h2>
            <div id="qr-reader" className="w-full"></div>
            <p className="mt-4 text-sm text-gray-500 text-center">Scan QR Code to Mark Drink as Served</p>
          </div>
        </div>

        {/* Guest List */}
        <div className="lg:col-span-2">
          <div className={`${NAVY_THEME.cardBg} p-6 rounded-xl shadow-2xl`}>
            <h2 className="text-2xl font-bold mb-4 text-blue-800">
              {filterType.title} List ({filteredGuests.length})
            </h2>

            <input
              type="text"
              placeholder="Search by Name or Phone..."
              className="w-full p-3 mb-6 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500 transition duration-150"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Table Header */}
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
                      index % 2 === 0 ? "bg-gray-50" : "bg-white"
                    } hover:bg-blue-50`}
                  >
                    <div className="col-span-3">
                      <p className="font-medium text-gray-800">{guest.fullname}</p>
                      <p className="text-xs text-gray-500">{guest.phonenumber}</p>
                    </div>
                    <div className="col-span-1 text-center">
                      {guest.drinks_received ? (
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
