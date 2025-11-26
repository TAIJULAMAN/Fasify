// =============================
// ADD NEW CAR (FINAL VERSION)
// =============================

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Input,
  Select,
  Upload,
  Checkbox,
  Form,
  Typography,
  Row,
  Col,
} from "antd";

import {
  UploadOutlined,
  CarOutlined,
  SettingOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  ToolOutlined,
  PlusOutlined,
} from "@ant-design/icons";

import Swal from "sweetalert2";
import {
  useCreateCarMutation,
  useGetCarPartnerMutation,
} from "../../redux/api/car/carApi";
import { currencyByCountry } from "../curenci";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function AddNewCar() {
  const navigate = useNavigate();
  const [carImages, setCarImages] = useState([]);

  const [createCar, { isLoading }] = useCreateCarMutation();
  const [getPartners, { data: partnersData, isLoading: partnersLoading }] =
    useGetCarPartnerMutation();

  // Fetch partners on component mount
  React.useEffect(() => {
    getPartners({ page: 1, limit: 100 });
  }, [getPartners]);

  console.log(partnersData, "partnersData");

  // Extract unique businesses with detailed information from partners data
  const getBusinesses = () => {
    if (!partnersData?.data?.data) return [];

    return partnersData.data.data
      .map((partner) => ({
        id: partner.id,
        partnerId: partner.partnerId,
        name: partner.carBusinessName,
        displayName: partner.carName,
        type: partner.carBusinessType,
        registration: partner.carRegNum,
        phone: partner.carPhone,
        email: partner.carEmail,
        logo: partner.businessLogo,
        tagline: partner.carTagline,
        description: partner.carRentalDescription,
        rentalType: partner.carRentalType,
        regDate: partner.carRegDate,
        bookingCondition: partner.carBookingCondition,
        cancelationPolicy: partner.carCancelationPolicy,
        hasDocuments: partner.carDocs && partner.carDocs.length > 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      businessName: "",
      carModel: "",
      carType: "",
      carSeats: "",
      carOilType: "",
      carEngineType: "",
      carTransmission: "",
      carPower: "",
      carDrivetrain: "",
      carMileage: "",
      carCapacity: "",
      carColor: "",
      fuelType: "",
      gearType: "",
      carRating: "0",
      carPriceDay: "",
      category: "",
      discount: 0,
      carAddress: "",
      carPostalCode: "",
      carDistrict: "",
      carCity: "",
      carCountry: "",
      carDescription: "",
      carServicesOffered: [],
      currency: "USD",
    },
  });

  // --- Generate Currency Options ---
  const generateCurrencyOptions = () => {
    const unique = new Set();
    const list = [];

    Object.values(currencyByCountry).forEach(({ code, symbol }) => {
      if (!unique.has(code)) {
        unique.add(code);
        list.push({ value: code, label: `${code} - ${symbol}` });
      }
    });

    return list.sort((a, b) => a.value.localeCompare(b.value));
  };

  // --- Handle Image Upload ---
  const handleImageUpload = ({ fileList }) => {
    const imgs = fileList.map((file) => ({
      file: file.originFileObj,
      preview: URL.createObjectURL(file.originFileObj),
    }));
    setCarImages(imgs);
  };

  // --- FINAL SUBMIT ---
  const onSubmit = async (data) => {
    if (carImages.length === 0) {
      return Swal.fire("No Images", "Upload at least one image", "warning");
    }

    // Find the selected business ID
    const selectedBusiness = getBusinesses().find(
      (business) => business.name === data.businessName
    );
    if (!selectedBusiness) {
      return Swal.fire("Error", "Please select a valid business", "error");
    }

    console.log("Selected Business:", selectedBusiness);
    console.log("Business ID:", selectedBusiness.id);
    console.log("Partner ID:", selectedBusiness.partnerId);

    // Try using partnerId instead of id for the API call
    const businessIdToUse = selectedBusiness.partnerId;
    console.log("Using Partner ID (not business ID):", businessIdToUse);

    const formData = new FormData();

    // --- EXACT API SCHEMA MAPPING ---
    const payload = {
      businessName: data.businessName,
      carAddress: data.carAddress,
      carPostalCode: data.carPostalCode,
      carDistrict: data.carDistrict,
      carCity: data.carCity,
      carCountry: data.carCountry,
      carDescription: data.carDescription,

      carType: data.carType,
      carSeats: data.carSeats,
      carOilType: data.carOilType,
      carEngineType: data.carEngineType,
      carTransmission: data.carTransmission,
      carPower: data.carPower,
      carDrivetrain: data.carDrivetrain,
      carMileage: data.carMileage,

      carModel: data.carModel,
      carCapacity: data.carCapacity,
      carColor: data.carColor,
      fuelType: data.fuelType,
      gearType: data.gearType,
      carRating: data.carRating || "0",

      carPriceDay: parseFloat(data.carPriceDay),
      category: data.category || "",
      discount: parseFloat(data.discount || 0),

      isBooked: "AVAILABLE",
      currency: data.currency,
    };

    // Append normal fields
    Object.entries(payload).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Append services
    if (Array.isArray(data.carServicesOffered)) {
      data.carServicesOffered.forEach((service) => {
        formData.append("carServicesOffered", service);
      });
    }

    // Append up to 5 images
    carImages.slice(0, 5).forEach((img) => {
      formData.append("carImages", img.file);
    });

    try {
      Swal.fire({
        title: "Creating Car...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const result = await createCar({
        formData,
        businessId: businessIdToUse,
      }).unwrap();
      console.log("Create Car Result:", result);

      Swal.close();
      Swal.fire("Success", "Car Added Successfully", "success");

      navigate("/dashboard/car-management");
    } catch (err) {
      console.error("Create Car Error:", err);
      Swal.close();
      Swal.fire("Error", err.data?.message || "Failed to Add Car", "error");
    }
  };

  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <Title level={2} className="flex items-center justify-center gap-3">
            <CarOutlined className="text-blue-600" />
            Add New Car
          </Title>
          <Text type="secondary" className="text-lg">
            Complete the form below to add a new car to your fleet.
          </Text>
        </div>

        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
          {/* =======================
              BASIC DETAILS
          ======================= */}
          <Card
            className="mb-6"
            title={
              <div className="flex items-center gap-2">
                <CarOutlined className="text-blue-600" />
                Basic Details
              </div>
            }
          >
            <div></div>
            <Row gutter={[16, 16]}>
              {/* Business Name */}
              <Col xs={24} md={12}>
                <Form.Item label="Business Name" required>
                  <Controller
                    name="businessName"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select
                        {...field}
                        size="large"
                        placeholder="Select business"
                        loading={partnersLoading}
                        showSearch
                        filterOption={(input, option) =>
                          option.children
                            ?.toLowerCase()
                            ?.indexOf(input.toLowerCase()) >= 0
                        }
                      >
                        {getBusinesses().map((business) => (
                          <Option key={business.id} value={business.name}>
                            {business.name}
                          </Option>
                        ))}
                      </Select>
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Car Model */}
              <Col xs={24} md={12}>
                <Form.Item label="Car Model" required>
                  <Controller
                    name="carModel"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="large"
                        placeholder="Toyota Camry 2023"
                      />
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Car Type */}
              <Col xs={24} md={12}>
                <Form.Item label="Car Type" required>
                  <Controller
                    name="carType"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select {...field} size="large" placeholder="Select type">
                        <Option value="SUV">SUV</Option>
                        <Option value="Sedan">Sedan</Option>
                        <Option value="Mini">Mini</Option>
                        <Option value="Van">Van</Option>
                        <Option value="Coupe">Coupe</Option>
                      </Select>
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Seats */}
              <Col xs={24} md={12}>
                <Form.Item label="Seats" required>
                  <Controller
                    name="carSeats"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="large"
                        placeholder="e.g., 4 or 7"
                      />
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Luggage */}
              <Col xs={24} md={12}>
                <Form.Item label="Luggage Capacity">
                  <Controller
                    name="carCapacity"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="large"
                        placeholder="2 large bags"
                      />
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Color */}
              <Col xs={24} md={12}>
                <Form.Item label="Color">
                  <Controller
                    name="carColor"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        size="large"
                        placeholder="Black, White"
                      />
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Fuel Type */}
              <Col xs={24} md={12}>
                <Form.Item label="Fuel Type">
                  <Controller
                    name="fuelType"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} size="large">
                        <Option value="Petrol">Petrol</Option>
                        <Option value="Diesel">Diesel</Option>
                        <Option value="Hybrid">Hybrid</Option>
                        <Option value="EV">Electric</Option>
                      </Select>
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Gear Type */}
              <Col xs={24} md={12}>
                <Form.Item label="Gear Type">
                  <Controller
                    name="gearType"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} size="large">
                        <Option value="Auto">Automatic</Option>
                        <Option value="Manual">Manual</Option>
                      </Select>
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Price */}
              <Col xs={24} md={12}>
                <Form.Item label="Price Per Day" required>
                  <Controller
                    name="carPriceDay"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        type="number"
                        size="large"
                        placeholder="50"
                      />
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Currency */}
              <Col xs={24} md={12}>
                <Form.Item label="Currency">
                  <Controller
                    name="currency"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} size="large" showSearch>
                        {generateCurrencyOptions().map((cur) => (
                          <Option key={cur.value} value={cur.value}>
                            {cur.label}
                          </Option>
                        ))}
                      </Select>
                    )}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* ===========================
              ENGINE DETAILS
          =========================== */}
          <Card
            className="mb-6"
            title={
              <div className="flex items-center gap-2">
                <SettingOutlined className="text-blue-600" />
                Engine & Performance
              </div>
            }
          >
            <Row gutter={[16, 16]}>
              {[
                {
                  name: "carOilType",
                  label: "Oil Type",
                  placeholder: "Synthetic 5W-30",
                },
                {
                  name: "carEngineType",
                  label: "Engine Type",
                  placeholder: "V6, Inline-4",
                },
                {
                  name: "carPower",
                  label: "Power (HP)",
                  placeholder: "200 HP",
                },
                {
                  name: "carMileage",
                  label: "Mileage",
                  placeholder: "15 km/l",
                },
              ].map((f) => (
                <Col xs={24} md={12} key={f.name}>
                  <Form.Item label={f.label}>
                    <Controller
                      name={f.name}
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          size="large"
                          placeholder={f.placeholder}
                        />
                      )}
                    />
                  </Form.Item>
                </Col>
              ))}

              {/* Transmission */}
              <Col xs={24} md={12}>
                <Form.Item label="Transmission">
                  <Controller
                    name="carTransmission"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} size="large">
                        <Option value="Auto">Automatic</Option>
                        <Option value="Manual">Manual</Option>
                      </Select>
                    )}
                  />
                </Form.Item>
              </Col>

              {/* Drivetrain */}
              <Col xs={24} md={12}>
                <Form.Item label="Drivetrain">
                  <Controller
                    name="carDrivetrain"
                    control={control}
                    render={({ field }) => (
                      <Select {...field} size="large">
                        <Option value="AWD">AWD</Option>
                        <Option value="RWD">RWD</Option>
                        <Option value="FWD">FWD</Option>
                        <Option value="4WD">4WD</Option>
                      </Select>
                    )}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* ===========================
              LOCATION
          =========================== */}
          <Card
            className="mb-6"
            title={
              <div className="flex items-center gap-2">
                <EnvironmentOutlined className="text-blue-600" />
                Car Location
              </div>
            }
          >
            <Row gutter={[16, 16]}>
              {[
                { name: "carAddress", label: "Address", required: true },
                { name: "carPostalCode", label: "Postal Code", required: true },
                { name: "carDistrict", label: "District" },
                { name: "carCity", label: "City", required: true },
                { name: "carCountry", label: "Country", required: true },
              ].map((f) => (
                <Col
                  xs={24}
                  md={f.name === "carAddress" ? 24 : 12}
                  key={f.name}
                >
                  <Form.Item label={f.label} required={f.required}>
                    <Controller
                      name={f.name}
                      control={control}
                      rules={f.required ? { required: true } : {}}
                      render={({ field }) => (
                        <Input {...field} size="large" placeholder={f.label} />
                      )}
                    />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Card>

          {/* ===========================
              DESCRIPTION
          =========================== */}
          <Card
            className="mb-6"
            title={
              <div className="flex items-center gap-2">
                <FileTextOutlined className="text-blue-600" />
                Description
              </div>
            }
          >
            <Form.Item label="Car Description" required>
              <Controller
                name="carDescription"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextArea
                    {...field}
                    rows={4}
                    size="large"
                    placeholder="Describe the car..."
                  />
                )}
              />
            </Form.Item>
          </Card>

          {/* ===========================
              SERVICES
          =========================== */}
          <Card
            className="mb-6"
            title={
              <div className="flex items-center gap-2">
                <ToolOutlined className="text-blue-600" />
                Services & Features
              </div>
            }
          >
            <Controller
              name="carServicesOffered"
              control={control}
              render={({ field }) => (
                <Checkbox.Group
                  {...field}
                  options={[
                    "AC",
                    "Heater",
                    "GPS",
                    "Bluetooth",
                    "Child Seat",
                    "USB Charger",
                    "Music System",
                    "WiFi",
                  ]}
                />
              )}
            />
          </Card>

          {/* ===========================
              IMAGES
          =========================== */}
          <Card
            className="mb-6"
            title={
              <div className="flex items-center gap-2">
                <UploadOutlined className="text-blue-600" />
                Car Images
              </div>
            }
          >
            <Upload
              listType="picture-card"
              multiple
              fileList={carImages.map((img, i) => ({
                uid: i,
                name: `Image ${i + 1}`,
                status: "done",
                url: img.preview,
              }))}
              beforeUpload={() => false}
              onChange={handleImageUpload}
              accept="image/*"
            >
              {carImages.length >= 5 ? null : (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </Card>

          {/* ===========================
              SUBMIT
          =========================== */}
          <div className="flex justify-end gap-4 mb-10">
            <Button size="large" onClick={() => navigate(-1)}>
              Cancel
            </Button>

            <Button
              type="primary"
              size="large"
              htmlType="submit"
              loading={isLoading}
            >
              {isLoading ? "Creating..." : "Create Car"}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
