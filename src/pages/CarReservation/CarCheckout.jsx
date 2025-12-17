import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSelector } from "react-redux";
import { jwtDecode } from "jwt-decode";
import { useCreateCarBookingMutation } from "../../redux/api/car/carApi";
import { handleError, handleSuccess } from "./../../../toast";
import { currencyByCountry } from "../../components/curenci";

export default function CarCheckout() {
  const location = useLocation();
  const navigate = useNavigate();

  const guest = location.state?.guestInfo || {};
  const rawState = location.state ?? null;
  const bookingDetails =
    rawState?.bookingDetails ?? rawState?.bookingData ?? rawState ?? null;

  const user = useSelector((state) => state?.auth?.user);
  const accessToken = useSelector((state) => state?.auth?.accessToken);

  // Currency detection states
  const [userCurrency, setUserCurrency] = useState(
    bookingDetails?.userCurrency || "USD"
  );
  const [userCountry, setUserCountry] = useState(
    bookingDetails?.userCountry || null
  );
  const [conversionRate, setConversionRate] = useState(
    bookingDetails?.conversionRate || 1
  );

  // Currency detection effect (only if not provided from booking details)
  React.useEffect(() => {
    if (bookingDetails?.userCurrency && bookingDetails?.conversionRate) {
      return;
    }

    const detect = async () => {
      try {
        const res = await fetch("https://api.country.is/");
        const data = await res.json();
        const country = data.country;

        if (country && currencyByCountry[country]) {
          setUserCountry(country);
          const userCurr = currencyByCountry[country].code;
          setUserCurrency(userCurr);

          // Fetch conversion: USD → user's currency
          let rate = 1;

          if ("USD" !== userCurr) {
            const rateRes = await fetch(
              "https://open.er-api.com/v6/latest/USD"
            );
            const rateData = await rateRes.json();

            if (rateData?.rates) {
              const usdToUser = rateData.rates[userCurr] || 1;
              rate = usdToUser;
            }
          }

          setConversionRate(rate);
        } else {
          setUserCurrency("USD");
          setConversionRate(1);
        }
      } catch (e) {
        setUserCurrency("USD");
        setConversionRate(1);
      }
    };

    detect();
  }, [bookingDetails]);

  const decodedUserInfo = useMemo(() => {
    if (!accessToken) return null;
    try {
      const decoded = jwtDecode(accessToken);
      return { ...user, ...decoded, token: accessToken };
    } catch (error) {
      return null;
    }
  }, [accessToken, user]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [createCarBooking] = useCreateCarBookingMutation();

  /* -------------------------------------------------------------------------- */
  /*                       🔹 FIXED DAYS CALCULATION                           */
  /* -------------------------------------------------------------------------- */
  const days = useMemo(() => {
    if (!bookingDetails?.pickupDate || !bookingDetails?.returnDate) return 1;

    const start = new Date(bookingDetails.pickupDate);
    const end = new Date(bookingDetails.returnDate);

    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [bookingDetails]);

  /* PRICE CALCULATIONS */
  const carPrice = useMemo(() => {
    if (!bookingDetails) return 0;

    // Use converted price if available, otherwise convert base price
    let price = Number(
      bookingDetails.unitPrice || bookingDetails.pricePerDay || 0
    );

    // If we have base price and conversion rate, convert it
    if (bookingDetails.basePrice && conversionRate && userCurrency) {
      price = Number(bookingDetails.basePrice * conversionRate).toFixed(2);
    }

    // If total is provided and greater than 0, calculate per-day price
    const totalValue = Number(bookingDetails.total || 0);
    const daysCount = days || 1;
    if (totalValue > 0) {
      price = totalValue / daysCount;
    }

    return price;
  }, [bookingDetails, days, conversionRate, userCurrency]);

  const displayVat = useMemo(() => {
    return (carPrice * days * 0.05).toFixed(2);
  }, [carPrice, days]);

  const displayFinalTotal = useMemo(() => {
    return (carPrice * days + Number(displayVat)).toFixed(2);
  }, [carPrice, days, displayVat]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  /* -------------------------------------------------------------------------- */
  /*                          🔹 USER INFO HANDLING                             */
  /* -------------------------------------------------------------------------- */
  const [updatedUser, setUpdatedUser] = useState({
    name:
      guest.fullName ||
      user?.fullName ||
      user?.name ||
      bookingDetails?.user?.fullName ||
      decodedUserInfo?.name ||
      "",
    email:
      guest.email ||
      user?.email ||
      bookingDetails?.user?.email ||
      decodedUserInfo?.email ||
      "",

    contactNo:
      guest.contactNo ||
      user?.contactNo ||
      user?.contactNumber ||
      bookingDetails?.user?.contactNo ||
      decodedUserInfo?.contactNo ||
      "",
    address:
      guest?.country ||
      user?.country ||
      bookingDetails?.user?.country ||
      bookingDetails?.carCountry ||
      decodedUserInfo?.country ||
      guest.address ||
      user?.address ||
      bookingDetails?.user?.address ||
      decodedUserInfo?.address ||
      "",
  });

  const userInfo = {
    id:
      user?.id ||
      user?._id ||
      decodedUserInfo?.id ||
      bookingDetails?.user?.id ||
      null,
    name: updatedUser?.name,
    email: updatedUser?.email,
    phone: updatedUser?.phone,
    contactNo: updatedUser?.contactNo,
    address: updatedUser?.address,
    country: updatedUser?.country,
  };

  const handleUpdatedUserChange = (e) => {
    const { name, value } = e.target;
    setUpdatedUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleBackToBooking = () => navigate(-1);

  /* -------------------------------------------------------------------------- */
  /*                     🔹 CONTINUE TO PAYMENT (BOOKING)                       */
  /* -------------------------------------------------------------------------- */
  // inside CarCheckout.jsx

  const handleContinueToPayment = async () => {
    if (!bookingDetails?.carId) {
      handleError("Unable to proceed: missing car selection.");
      return;
    }

    setIsProcessing(true);

    try {
      // per‑day price (unit price), will be 100 (or whatever per‑day is)
      const dailyPrice = Number(bookingDetails?.unitPrice || 0);

      const bookingPayload = {
        // --- USER INFO ---
        name: updatedUser?.name,
        email: updatedUser?.email,
        phone: updatedUser?.phone,
        contactNo: updatedUser?.contactNo,
        address: updatedUser?.address,
        country: updatedUser?.country,

        // --- PRICE INFO (PER-DAY) ---
        // Backend will do: amount = totalPrice * days
        convertedPrice: carPrice, // per-day (already converted)
        totalPrice: carPrice, // per-day (already converted)
        displayCurrency:
          userCurrency ||
          bookingDetails.displayCurrency ||
          bookingDetails.currency ||
          "USD",
        discountedPrice: bookingDetails.discountedPrice || 0,

        // --- BOOKING INFO ---
        carBookedFromDate: bookingDetails.pickupDate,
        carBookedToDate: bookingDetails.returnDate,
        currency:
          bookingDetails.baseCurrency || bookingDetails.currency || "USD",
        location: bookingDetails.location,
        carName: bookingDetails.carName,
        carSeats: bookingDetails.carSeats,
        carCountry: bookingDetails.carCountry,
        carCancelationPolicy: bookingDetails.carCancelationPolicy,
        days, // backend multiplies by this
        guests: bookingDetails.guests || 1,
        unitPrice: carPrice, // keep per-day here too (converted)
        description: bookingDetails.carDescription,

        // --- USER REF ---
        userId: userInfo.id,
        user: userInfo,

        // --- CURRENCY CONVERSION DETAILS ---
        userCurrency,
        userCountry,
        conversionRate,
        baseCurrency:
          bookingDetails.baseCurrency || bookingDetails.currency || "USD",
        basePrice: bookingDetails.basePrice || bookingDetails.unitPrice || 0,
      };

      const response = await createCarBooking({
        carId: bookingDetails.carId,
        data: bookingPayload,
      }).unwrap();

      const createdBookingId =
        response?.data?.bookingId ||
        response?.data?._id ||
        response?.data?.id ||
        response?.bookingId ||
        null;

      if (!createdBookingId)
        throw new Error("Booking reference missing from server.");

      handleSuccess("Car reserve successfully!");

      // Payment page uses full total only for DISPLAY
      navigate("/car/payment", {
        state: {
          bookingDetails: {
            ...bookingDetails,
            bookingId: createdBookingId,
            // optional: keep vat just for showing breakdown
            vat: Number(displayVat),
            user: userInfo,

            // Add currency conversion for payment page
            userCurrency,
            userCountry,
            conversionRate,
            displayFinalTotal: Number(displayFinalTotal),
            displayCurrency:
              userCurrency ||
              bookingDetails.displayCurrency ||
              bookingDetails.currency ||
              "USD",
          },
        },
      });
    } catch (error) {
      handleError(
        error?.data?.message || error?.message || "Failed to create booking."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                UI SECTION                                  */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* HEADER */}
        <div className="my-10 flex items-center justify-start">
          <button
            onClick={handleBackToBooking}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-8 h-8 mr-2" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        </div>

        {!bookingDetails ? (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <p className="text-gray-700 mb-4">No booking details found.</p>
            <button
              onClick={handleBackToBooking}
              className="bg-[#0064D2] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#0053ad]"
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT SECTION — USER INFO + BOOKING SUMMARY */}
            <div className="lg:col-span-2 space-y-5 bg-white rounded-xl shadow-sm p-5">
              {/* Guest Info Form */}
              <div className="bg-blue-50 rounded-lg p-5">
                <h2 className="text-xl font-semibold mb-5">
                  Guest Information
                </h2>

                <form className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={updatedUser.name}
                      onChange={handleUpdatedUserChange}
                      className="mt-1 w-full rounded-md border p-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={updatedUser.email}
                      onChange={handleUpdatedUserChange}
                      className="mt-1 w-full rounded-md border p-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      name="contactNo"
                      value={updatedUser.contactNo}
                      onChange={handleUpdatedUserChange}
                      className="mt-1 w-full rounded-md border p-2"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={updatedUser.address}
                      onChange={handleUpdatedUserChange}
                      className="mt-1 w-full rounded-md border p-2"
                    />
                  </div>
                </form>
              </div>

              {/* Booking Summary */}
              <div>
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-gray-600">Car Model</span>
                    <span className="font-medium text-gray-900">
                      {bookingDetails.carName}
                    </span>
                  </div>

                  <div className="flex justify-between py-3 border-b">
                    <span className="text-gray-600">Pickup Location</span>
                    <span className="font-medium text-gray-900">
                      {bookingDetails.location}
                    </span>
                  </div>

                  <div className="py-3 border-b space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Pickup Date</span>
                      <span className="font-medium text-gray-900">
                        {formatDate(bookingDetails.pickupDate)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Return Date</span>
                      <span className="font-medium text-gray-900">
                        {formatDate(bookingDetails.returnDate)}
                      </span>
                    </div>

                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-sm text-gray-500">Duration</span>
                      <span className="font-medium text-gray-900">
                        {days} {days === 1 ? "day" : "days"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SECTION – PRICE SUMMARY */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-6 sticky top-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Price Summary
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {userCurrency ||
                        bookingDetails.displayCurrency ||
                        bookingDetails.currency}{" "}
                      {Number(carPrice).toLocaleString()} × {days}{" "}
                      {days === 1 ? "day" : "days"}
                    </span>
                    <span className="text-gray-900">
                      {userCurrency ||
                        bookingDetails.displayCurrency ||
                        bookingDetails.currency}{" "}
                      {Number(carPrice * days).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">VAT 5%</span>
                    <span className="text-gray-900">
                      {userCurrency ||
                        bookingDetails.displayCurrency ||
                        bookingDetails.currency}{" "}
                      {Number(displayVat).toLocaleString()}
                    </span>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <span className="text-lg font-semibold">
                        Total Amount
                      </span>
                      <span className="text-lg font-semibold">
                        {userCurrency ||
                          bookingDetails.displayCurrency ||
                          bookingDetails.currency}{" "}
                        {Number(displayFinalTotal).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleContinueToPayment}
                  disabled={isProcessing}
                  className={`w-full mt-6 py-3 text-white rounded-lg font-medium ${
                    isProcessing
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-blue-700 hover:bg-blue-800"
                  }`}
                >
                  {isProcessing ? "Processing..." : "Continue"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
