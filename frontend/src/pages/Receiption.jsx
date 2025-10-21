// ReceptionDashboard.jsx
import { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import { Html5QrcodeScanner } from "html5-qrcode";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Define the base styles for the navy theme
const NAVY_THEME = {
  pageBg: "bg-gray-100",
  primary: "bg-blue-800",
  primaryHover: "hover:bg-blue-700",
  cardBg: "bg-white",
  textColor: "text-gray-700",
};

export default function ReceptionDashboard() {
  const [allGuests, setAllGuests] = useState([]);
  const [total, setTotal] = useState(0);
  const [attended, setAttended] = useState(0);
  const [notAttended, setNotAttended] = useState(0);
  const [filterType, setFilterType] = useState({ key: "TOTAL", title: "Total Guests" });
  const [searchTerm, setSearchTerm] = useState("");

  const scannerRef = useRef(null);
  const API_URL = "https://guestsystem.onrender.com/api/guests";
  const getToken = () => localStorage.getItem("token");

  const fetchGuests = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const guestsData = res.data.guests;
      setAllGuests(guestsData);
      setTotal(guestsData.length);
      const attendedCount = guestsData.filter((g) => g.attendance_checked).length;
      setAttended(attendedCount);
      setNotAttended(guestsData.length - attendedCount);
    } catch (err) {
      console.error("Failed to fetch guests:", err);
    }
  };

  useEffect(() => {
    fetchGuests();

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

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((e) => console.error("Error clearing scanner", e));
      }
    };
  }, []);

  const handleScan = async (data) => {
    if (!data) return;

    const guestIdMatch = data.match(/\d+/);
    if (!guestIdMatch) {
      toast.error("❌ Invalid QR Code. Cannot find Guest ID.");
      return;
    }
    const guestId = parseInt(guestIdMatch[0], 10);

    try {
      const res = await axios.post(
        `${API_URL}/scan`,
        { guestId },
        { headers: { "Content-Type": "application/json" } }
      );

      toast.success(
        `✅ Checked In: ${res.data.guest.fullname} (${res.data.guest.phonenumber})`
      );

      fetchGuests();
    } catch (err) {
      toast.error(err.response?.data?.message || "❌ Scan failed / already scanned");
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

  const filteredGuests = useMemo(() => {
    const filterKey = filterType.key;
    return allGuests
      .filter((guest) => {
        const statusMatch =
          filterKey === "TOTAL" ||
          (filterKey === "ATTENDED" && guest.attendance_checked) ||
          (filterKey === "NOT_ATTENDED" && !guest.attendance_checked);

        const searchLower = searchTerm.toLowerCase();
        const phoneMatch = guest.phonenumber
          ? guest.phonenumber.toLowerCase().includes(searchLower)
          : true;
        const nameMatch = guest.fullname
          ? guest.fullname.toLowerCase().includes(searchLower)
          : true;

        return statusMatch && (phoneMatch || nameMatch);
      })
      .sort((a, b) => {
        if (a.attendance_checked !== b.attendance_checked) {
          return a.attendance_checked ? -1 : 1;
        }
        return a.fullname?.localeCompare(b.fullname || "") || 0;
      });
  }, [allGuests, filterType.key, searchTerm]);

  const StatCard = ({ title, count, type }) => {
    const isActive = filterType.key === type;
    const cardClasses = `p-4 rounded-xl shadow-lg text-center cursor-pointer transform transition duration-300 ${NAVY_THEME.primaryHover} ${
      isActive
        ? `${NAVY_THEME.primary} text-white shadow-blue-500/50 scale-[1.02]`
        : `${NAVY_THEME.cardBg} ${NAVY_THEME.textColor}`
    }`;
    const countClasses = `text-3xl mt-2 font-extrabold ${isActive ? "text-white" : "text-blue-600"}`;
    const titleClasses = `text-xl font-semibold ${isActive ? "text-blue-100" : "text-blue-800"}`;
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
      <ToastContainer position="top-right" autoClose={3000} />
      <h1 className="text-4xl font-extrabold mb-8 text-blue-800 border-b pb-2 border-blue-200">
        Reception Dashboard
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Guests" count={total} type="TOTAL" />
        <StatCard title="Attended Guests" count={attended} type="ATTENDED" />
        <StatCard title="Not Attended" count={notAttended} type="NOT_ATTENDED" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className={`${NAVY_THEME.cardBg} p-6 rounded-xl shadow-2xl sticky top-6`}>
            <h2 className="text-2xl font-bold mb-4 text-blue-800">QR Scanner</h2>
            <div id="qr-reader" className="w-full"></div>
            <p className="mt-4 text-sm text-gray-500 text-center">
              Scan QR Code to Check-In Guest
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className={`${NAVY_THEME.cardBg} p-6 rounded-xl shadow-2xl`}>
            <h2 className="text-2xl font-bold mb-4 text-blue-800">
              {filterType.title} List ({filteredGuests.length})
            </h2>
            <input
              type="text"
              placeholder="Search by Name or Phone Number..."
              className="w-full p-3 mb-6 border-2 border-blue-200 rounded-lg focus:outline-none focus:border-blue-500 transition duration-150"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div
              className={`grid grid-cols-5 p-3 font-semibold text-sm rounded-t-lg ${NAVY_THEME.primary} text-white`}
            >
              <div className="col-span-3">Guest Name / Phone</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-1 text-center">ID</div>
            </div>

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
                <div className="p-10 text-center text-gray-500">
                  No guests match the current filter/search criteria.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
