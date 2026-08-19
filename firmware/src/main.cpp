#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include "DHT.h"
#include <Wire.h> 
#include <LiquidCrystal_I2C.h> // Thư viện cho màn hình LCD I2C
#include "../include/secrets.h"

// --- CẤU HÌNH CẢM BIẾN DHT ---
#define DHTPIN 4        
#define DHTTYPE DHT22   // Dùng DHT22
#define MQ2_PIN 34      // MQ2 AO, chỉ dùng chân ADC input của ESP32

DHT dht(DHTPIN, DHTTYPE);

// --- CẤU HÌNH LCD 1602 I2C ---
// Khai báo màn hình LCD dùng I2C: Địa chỉ 0x27, loại 16 cột 2 hàng
LiquidCrystal_I2C lcd(0x27, 16, 2); 

WiFiClientSecure secureClient;
WiFiClient mqttNetworkClient;
PubSubClient mqttClient(mqttNetworkClient);

bool publishDht22Mqtt(const String& body) {
#if LATA_MQTT_ENABLED
  if (!mqttClient.connected()) {
    String clientId = String("lata-") + LATA_DEVICE_ID + "-" + String(random(0xffff), HEX);
    Serial.printf("Dang ket noi MQTT %s:%u\n", LATA_MQTT_BROKER, LATA_MQTT_PORT);
    if (!mqttClient.connect(clientId.c_str())) {
      Serial.printf("MQTT ket noi that bai, ma loi: %d\n", mqttClient.state());
      return false;
    }
    Serial.println("MQTT da ket noi");
  }

  if (!mqttClient.publish(LATA_MQTT_TOPIC, body.c_str())) {
    Serial.println("MQTT publish that bai");
    return false;
  }

  Serial.printf("Da publish DHT22 len MQTT: %s\n", LATA_MQTT_TOPIC);
  return true;
#else
  return false;
#endif
}

void sendSensorReading(float temperature, float humidity, int mq2Raw) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Khong gui duoc DHT22: WiFi mat ket noi");
    return;
  }

  JsonDocument payload;
  payload["deviceId"] = LATA_DEVICE_ID;
  payload["dht22_temperature_c"] = temperature;
  payload["dht22_humidity_percent"] = humidity;
  payload["mq2_raw"] = mq2Raw;

  String body;
  serializeJson(payload, body);

  if (publishDht22Mqtt(body)) return;

  secureClient.setInsecure();
  HTTPClient http;
  if (!http.begin(secureClient, LATA_API_URL)) {
    Serial.println("Khong khoi tao duoc ket noi HTTP");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", LATA_API_KEY);
  const int responseCode = http.POST(body);
  Serial.printf("Gui DHT22 + MQ2 len API: HTTP %d\n", responseCode);
  if (responseCode > 0) {
    Serial.println(http.getString());
  } else {
    Serial.printf("Loi HTTP: %s\n", http.errorToString(responseCode).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  
  // KHỞI TẠO LCD I2C
  lcd.init();
  lcd.backlight(); // Bật đèn nền LCD
  lcd.setCursor(0, 0);
  lcd.print("Dang cai WiFi...");

  // Khởi tạo cảm biến DHT
  dht.begin();
  analogReadResolution(12);
  analogSetPinAttenuation(MQ2_PIN, ADC_11db);

  // --- CẤU HÌNH WIFI MANAGER ---
  WiFiManager wm;
  Serial.println("Đang khởi tạo Access Point để cài đặt WiFi...");
  
  // wm.resetSettings(); // Bỏ comment dòng này nếu muốn ESP32 quên WiFi cũ để chọn lại từ đầu
  
  bool res = wm.autoConnect("ESP32_Config"); 

  if(!res) {
    Serial.println("Không thể kết nối hoặc hết thời gian chờ!");
    lcd.clear();
    lcd.print("Loi ket noi WiFi");
    delay(3000);
    ESP.restart(); 
  } 
  else {
    Serial.println("Đã kết nối WiFi thành công!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi: OK!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP()); // In địa chỉ IP ra màn hình
    delay(3000); // Dừng 3 giây để bạn kịp nhìn IP
    lcd.clear();
  }

  mqttClient.setServer(LATA_MQTT_BROKER, LATA_MQTT_PORT);
  Serial.printf("MQTT da cau hinh: %s:%u, topic %s\n", LATA_MQTT_BROKER, LATA_MQTT_PORT, LATA_MQTT_TOPIC);
}

void loop() {
  mqttClient.loop();
  delay(2000); // Đợi 5s giữa các lần đọc và gửi dữ liệu

  float h = dht.readHumidity();
  float t = dht.readTemperature();
  const int mq2Raw = analogRead(MQ2_PIN);

  if (isnan(h) || isnan(t)) {
    Serial.println("Lỗi: Không thể đọc dữ liệu từ cảm biến DHT!");
    lcd.setCursor(0, 0);
    lcd.print("Loi doc DHT22   ");
    return;
  }

  // In ra Serial Monitor
  Serial.print("Nhiệt độ: ");
  Serial.print(t);
  Serial.print("°C  |  Độ ẩm: ");
  Serial.print(h);
  Serial.println("%");
  Serial.print("MQ2 raw: ");
  Serial.println(mq2Raw);

  // Hiển thị cả MQ2 và DHT22 cố định trên hai dòng LCD.
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("MQ2: ");
  lcd.print(mq2Raw);
  lcd.print(" ADC");
  lcd.setCursor(0, 1);
  lcd.print("T:");
  lcd.print(t, 1);
  lcd.print("C H:");
  lcd.print(h, 1);
  lcd.print("%");

  sendSensorReading(t, h, mq2Raw);
}