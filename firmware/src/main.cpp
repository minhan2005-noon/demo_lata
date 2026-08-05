#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h> 
#include <esp_now.h> 
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFiManager.h> 
#include <PubSubClient.h> // THÊM: Thư viện MQTT


const char* serverName = "https://lata-e10g.onrender.com/api/sensors/data"; 

// THÊM: Cấu hình MQTT Broker
const char* mqtt_broker = "192.168.1.100"; // THAY ĐỔI ĐỊA CHỈ IP/DOMAIN CỦA BROKER VÀO ĐÂY
const int mqtt_port = 1883;
const char* mqtt_topic = "lata/lata-001/data";

WiFiClient espClient;           // THÊM: Client cho MQTT
PubSubClient mqttClient(espClient); // THÊM: Khởi tạo MQTT Client

#define DHTPIN 15        
#define DHTTYPE DHT22      
DHT dht(DHTPIN, DHTTYPE);

#define MQ2_PIN 34  
#define BUZZER_PIN 25    
#define LED_PIN 27      
#define RELAY_PIN 26  

#define BUTTON_PIN 32      
bool lastButtonState = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 250;

uint8_t masterAddress[] = { 0xcc,0x50,0xe3,0xab,0x85,0xd4 }; 

// Ngưỡng cảnh báo
const int GAS_THRESHOLD = 1500;    
const float TEMP_THRESHOLD = 32.0; 

// Biến trạng thái toàn cục
bool isFanOnByTemp = false;
bool isGasAlert = false;
int fanControlMode = 0; // 0=AUTO, 1=ON, 2=OFF

LiquidCrystal_I2C lcd(0x27, 16, 2);
unsigned long lastSend = 0;
unsigned long lastMQTTReconnectAttempt = 0; // THÊM: Biến đếm thời gian reconnect MQTT

typedef struct {
  float temperature;
  float humidity;
  int gas;
  bool gasAlert;
  bool fanStatus;
  int fanMode;
} Node1Data;

Node1Data dataToMaster;

// ==========================================
// KHAI BÁO NGUYÊN MẪU HÀM
// ==========================================
void setup_wifi();
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status);
boolean reconnectMQTT(); // THÊM: Hàm reconnect MQTT

// ==========================================
// ĐỊNH NGHĨA HÀM
// ==========================================

void setup_wifi() {
  delay(10);
  Serial.println("Đang khởi tạo WiFiManager...");
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Setup...");
  lcd.setCursor(0, 1);
  lcd.print("Connect to AP");

  WiFiManager wifiManager;

  if (!wifiManager.autoConnect("ESP32_Config")) {
    Serial.println("Kết nối thất bại và quá thời gian chờ (timeout)");
    delay(3000);
    ESP.restart(); 
  }

  Serial.println("\nWiFi đã kết nối thành công!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected!");
  delay(2000);
  lcd.clear();
}

void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  Serial.print("ESP-NOW: ");
  if(status == ESP_NOW_SEND_SUCCESS) {
    Serial.println("SUCCESS");
  } else {
    Serial.println("FAIL");
  }
}

// THÊM: Hàm kết nối MQTT không làm treo hệ thống
boolean reconnectMQTT() {
  Serial.print("Đang kết nối MQTT Broker...");
  String clientId = "ESP32-Lata001-";
  clientId += String(random(0xffff), HEX);
  
  if (mqttClient.connect(clientId.c_str())) {
    Serial.println("Đã kết nối MQTT!");
    return true;
  } else {
    Serial.print("Thất bại, rc=");
    Serial.println(mqttClient.state());
    return false;
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  digitalWrite(BUZZER_PIN, HIGH); 
  digitalWrite(LED_PIN, LOW);     
  digitalWrite(RELAY_PIN, LOW);   

  dht.begin();
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("System Starting");

  // 1. Kết nối WiFi
  WiFi.mode(WIFI_STA);
  setup_wifi(); 

  // 2. Cấu hình MQTT Broker
  mqttClient.setServer(mqtt_broker, mqtt_port);

  // 3. Khởi tạo ESP-NOW
  int32_t wifiChannel = WiFi.channel();
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Init Failed");
  } else {
    Serial.println("ESP-NOW Ready");
  }
  esp_now_register_send_cb((esp_now_send_cb_t)OnDataSent);

  esp_now_peer_info_t peerInfo;
  memset(&peerInfo, 0, sizeof(peerInfo)); 
  memcpy(peerInfo.peer_addr, masterAddress, 6);
  peerInfo.channel = wifiChannel; 
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Add Peer Failed");
  }
}

void loop() {
  // THÊM: Xử lý kết nối và duy trì MQTT
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      unsigned long now = millis();
      // Cố gắng kết nối lại mỗi 5 giây (tránh treo vòng lặp)
      if (now - lastMQTTReconnectAttempt > 5000) {
        lastMQTTReconnectAttempt = now;
        if (reconnectMQTT()) {
          lastMQTTReconnectAttempt = 0;
        }
      }
    } else {
      mqttClient.loop(); // Duy trì kết nối MQTT
    }
  }

  // --- Xử lý nút nhấn ---
  int currentButtonState = digitalRead(BUTTON_PIN);
  if (currentButtonState == LOW && lastButtonState == HIGH) {
    if ((millis() - lastDebounceTime) > debounceDelay) {
      bool autoFanOn = (isFanOnByTemp || isGasAlert); 
      if (fanControlMode == 0) { 
        fanControlMode = autoFanOn ? 2 : 1; 
      }
      else if (fanControlMode == 1) fanControlMode = 0; 
      else if (fanControlMode == 2) fanControlMode = 1; 

      lastDebounceTime = millis();
      Serial.print("Nút nhấn kích hoạt! Chế độ quạt: ");
      Serial.println(fanControlMode);
    }
  }
  lastButtonState = currentButtonState;

  // --- Xử lý logic quạt ---
  bool autoFanOn = (isFanOnByTemp || isGasAlert);
  bool isFanOn = false;
  if (fanControlMode == 0) isFanOn = autoFanOn; 
  else if (fanControlMode == 1) isFanOn = true;      
  else if (fanControlMode == 2) isFanOn = false;     

  digitalWrite(RELAY_PIN, isFanOn ? HIGH : LOW);

  // --- Vòng lặp 2 giây đọc cảm biến và gửi dữ liệu ---
  if (millis() - lastSend > 2000) {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    int gasValue = analogRead(MQ2_PIN);

    if (isnan(t) || isnan(h)) {
      Serial.println("Lỗi đọc cảm biến DHT!");
      return;
    }

    isGasAlert = (gasValue > GAS_THRESHOLD);
    if (isGasAlert) {
      digitalWrite(BUZZER_PIN, LOW); 
      if (fanControlMode == 2) {
        fanControlMode = 0;
        Serial.println("CẢNH BÁO GAS: Hủy lệnh Ép Tắt!");
      }
    } else {
      digitalWrite(BUZZER_PIN, HIGH); 
    }

    bool isLedOn = (t > TEMP_THRESHOLD);
    digitalWrite(LED_PIN, isLedOn ? HIGH : LOW);

    if (t > TEMP_THRESHOLD) isFanOnByTemp = true;                
    else if (t < (TEMP_THRESHOLD - 1.0)) isFanOnByTemp = false;                

    // Cập nhật LCD
    lcd.setCursor(0, 0);
    lcd.print("G:"); lcd.print(gasValue); lcd.print(" ");
    lcd.setCursor(8, 0);
    if (fanControlMode == 0) lcd.print("M:AUTO ");
    else if (fanControlMode == 1) lcd.print("M:ON   ");
    else if (fanControlMode == 2) lcd.print("M:OFF  ");
    lcd.setCursor(14, 0);
    if(isGasAlert) lcd.print("!!"); else lcd.print("  ");
    
    lcd.setCursor(0, 1);
    lcd.print("T:"); lcd.print(t, 1); 
    lcd.print("C H:"); lcd.print(h, 0); lcd.print("%  ");  

    // Tạo chuỗi JSON
    String payload = "{";
    payload += "\"temperature\":"; payload += t; payload += ",";
    payload += "\"humidity\":"; payload += h; payload += ",";
    payload += "\"gas\":"; payload += gasValue; payload += ",";
    payload += "\"led_status\":"; payload += (isLedOn ? "true" : "false"); payload += ",";
    payload += "\"fan_status\":"; payload += (isFanOn ? "true" : "false"); payload += ",";
    payload += "\"fan_mode\":"; payload += fanControlMode; 
    payload += "}";

    Serial.print("Payload: ");
    Serial.println(payload);
    
    if(WiFi.status() == WL_CONNECTED) {
      // ==========================================
      // PUBLISH MQTT
      // ==========================================
      if (mqttClient.connected()) {
        // Gửi payload JSON tới topic yêu cầu
        if(mqttClient.publish(mqtt_topic, payload.c_str())) {
          Serial.println("Đã publish lên MQTT thành công!");
        } else {
          Serial.println("Lỗi publish MQTT!");
        }
      }

      // ==========================================
      // HTTP POST (Giữ nguyên như cũ)
      // ==========================================
      WiFiClientSecure client;
      client.setInsecure(); 
      HTTPClient http;
      http.begin(client, serverName); 
      http.addHeader("Content-Type", "application/json"); 

      int httpResponseCode = http.POST(payload);
      if (httpResponseCode > 0) {
        String response = http.getString();
        if (response.indexOf("setFanStatus") != -1) {
          if (response.indexOf("true") != -1) fanControlMode = 1; 
          else if (response.indexOf("false") != -1) fanControlMode = 2; 
        }
        else if (response.indexOf("setAutoMode") != -1) {
          fanControlMode = 0; 
        }
      }
      http.end();
    }
    
    // Gửi thông tin qua ESP-NOW
    dataToMaster.temperature = t;
    dataToMaster.humidity = h;
    dataToMaster.gas = gasValue;
    dataToMaster.gasAlert = isGasAlert;
    dataToMaster.fanStatus = isFanOn;
    dataToMaster.fanMode = fanControlMode;

    esp_now_send(masterAddress, (uint8_t *)&dataToMaster, sizeof(dataToMaster));
    lastSend = millis();
  }
}
