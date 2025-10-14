import { useEffect, useState, useCallback } from "react"; // ADD useCallback
import axios from "axios";
import { QrReader } from "react-qr-reader";

export default function ReceptionDashboard() {
  const [guests, setGuests] = useState([]);
  const [total, setTotal] = useState(0);
  const [attended, setAttended] = useState(0);
  const [notAttended, setNotAttended] = useState(0);

  // Using a separate state for loading/scanning status for better UX
  const [isScanning, setIsScanning] = useState(false); 
  const [scanData, setScanData] = useState(null); // To prevent continuous scanning/API calls

  const API_URL = "http://192.168.1.147:5000/api/guests";

  const fetchGuests = async () => {
    try {
      // It's good practice to get the auth token here if needed
      const res = await axios.get(API_URL);
      const allGuests = res.data.guests;
      setGuests(allGuests);
      setTotal(allGuests.length);
      const attendedCount = allGuests.filter(g => g.attendance_checked).length;
      setAttended(attendedCount);
      setNotAttended(allGuests.length - attendedCount);
    } catch (err) {
      console.error("Failed to fetch guests:", err);
      // Optional: Add state to show an error message on the dashboard
    }
  };

  // Wrap handleScan in useCallback to stabilize it as a dependency (if fetchGuests were dynamic)
  const handleScan = useCallback(async (data) => {
    if (isScanning || !data) return;
    
    // Set scanning state to prevent rapid, duplicate API calls
    setIsScanning(true); 

    try {
      // Ensures only digits are used for guestId
      const guestId = parseInt(data.replace(/\D/g, ""), 10); 
      
      const res = await axios.post(`${API_URL}/scan`, { guestId });

      // success beep
      new Audio("/beep-success.mp3").play();

      alert(`✅ Guest Checked In!\nName: ${res.data.guest.fullname}\nPhone: ${res.data.guest.phonenumber}`);

      // Refresh guest list and stats
      await fetchGuests();

    } catch (err) {
      // error beep
      new Audio("/beep-error.mp3").play();

      alert(err.response?.data?.message || "❌ Scan failed / already scanned");
      
    } finally {
      // Re-enable scanning after a short delay to prevent instant re-scan
      setTimeout(() => setIsScanning(false), 2000); 
    }
  }, [API_URL, isScanning]);


  useEffect(() => { 
      // Initial fetch
      fetchGuests(); 
  }, []); 

  // Secondary effect to handle scan data change from QrReader
  useEffect(() => {
    if (scanData && !isScanning) {
        handleScan(scanData);
        // Clear the data immediately after handling to be ready for the next scan
        setScanData(null); 
    }
  }, [scanData, isScanning, handleScan]);


  return (
    <div className="p-6 font-sans bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-4">Reception Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow text-center">
          <h2 className="text-xl font-semibold">Total Guests</h2>
          <p className="text-2xl mt-2">{total}</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <h2 className="text-xl font-semibold">Attended Guests</h2>
          <p className="text-2xl mt-2 text-green-600">{attended}</p>
        </div>
        <div className="bg-white p-4 rounded shadow text-center">
          <h2 className="text-xl font-semibold">Not Attended</h2>
          <p className="text-2xl mt-2 text-red-600">{notAttended}</p>
        </div>
      </div>

      {/* QR Scanner */}
      <div className="bg-white p-4 rounded shadow max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-2">Scan QR Code</h2>
        <div className="relative w-full aspect-square overflow-hidden rounded">
            <QrReader
              onResult={(result, error) => {
                // Check if a result object exists and has text data
                if (result) {
                    // Update state to trigger the API call in the useEffect hook
                    setScanData(result.text); 
                }
              }}
              constraints={{ facingMode: "environment" }}
              containerStyle={{ width: "100%", height: "100%" }}
            />
            {isScanning && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-lg font-bold">
                    Processing Scan...
                </div>
            )}
        </div>
        
        {/* Optional: Manual ID input fallback */}
        <div className="mt-4 text-center text-sm text-gray-500">
            Scanning status: {isScanning ? 'Busy' : 'Ready'}
        </div>
      </div>
      
      {/* You might want to display the full guests list here as well */}
    </div>
  );
}