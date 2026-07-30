#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h> // Thêm thư viện HTTP Client thay cho PubSubClient
#include <esp_now.h> 
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFiManager.h> // Cấu hình WiFi động giữ nguyên

// ĐIỀN URL TỚI API TRÊN WEBSITE CỦA BẠN VÀO ĐÂY
const char* serverName = ""; 

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
const int GAS_THRESHOLD = 1500;    // Ngưỡng khí gas (0-4095)
const float TEMP_THRESHOLD = 32.0; // Ngưỡng nhiệt độ cảnh báo (độ C)

// Biến trạng thái toàn cục
bool isFanOnByTemp = false;
bool isGasAlert = false;

// Biến quản lý chế độ hoạt động của Quạt:
// 0 = TỰ ĐỘNG (AUTO)
// 1 = ÉP BẬT BẰNG TAY (MANUAL_ON)
// 2 = ÉP TẮT BẰNG TAY (MANUAL_OFF)
int fanControlMode = 0;

LiquidCrystal_I2C lcd(0x27, 16, 2);
unsigned long lastSend = 0;

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

  // Xóa cài đặt cũ (Nếu bạn muốn reset lại mật khẩu WiFi, hãy bỏ // ở dòng dưới)
  // wifiManager.resetSettings();

  // Tạo Access Point tên là "ESP32_Config"
  if (!wifiManager.autoConnect("ESP32_Config")) {
    Serial.println("Kết nối thất bại và quá thời gian chờ (timeout)");
    delay(3000);
    ESP.restart(); // Reset mạch để thử lại
  }

  // Nếu tới được đây nghĩa là đã kết nối WiFi thành công
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

  WiFi.mode(WIFI_STA);
  //setup_wifi(); // Gọi hàm cài đặt WiFi động

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW Init Failed");
  } else {
    Serial.println("ESP-NOW Ready");
  }

  esp_now_register_send_cb((esp_now_send_cb_t)OnDataSent);

  esp_now_peer_info_t peerInfo;
  memset(&peerInfo, 0, sizeof(peerInfo)); 
  
  memcpy(peerInfo.peer_addr, masterAddress, 6);
  
  peerInfo.channel = 0; 
  peerInfo.encrypt = false;

  if (esp_now_add_peer(&peerInfo) != ESP_OK) {
    Serial.println("Add Peer Failed");
  } else {
    Serial.println("Peer Added");
  }
}

void loop() {
  int currentButtonState = digitalRead(BUTTON_PIN);
  if (currentButtonState == LOW && lastButtonState == HIGH) {
    if ((millis() - lastDebounceTime) > debounceDelay) {
      
      bool autoFanOn = (isFanOnByTemp || isGasAlert); 

      if (fanControlMode == 0) { 
        if (autoFanOn) {
          fanControlMode = 2; 
        } else {
          fanControlMode = 1; 
        }
      }
      else if (fanControlMode == 1) { 
        fanControlMode = 0; 
      }
      else if (fanControlMode == 2) { 
        fanControlMode = 1; 
      }

      lastDebounceTime = millis();
      Serial.print("Nút nhấn kích hoạt! Chế độ quạt hiện tại: ");
      Serial.println(fanControlMode);
    }
  }
  lastButtonState = currentButtonState;

  bool autoFanOn = (isFanOnByTemp || isGasAlert);
  bool isFanOn = false;

  if (fanControlMode == 0) {
    isFanOn = autoFanOn; 
  } else if (fanControlMode == 1) {
    isFanOn = true;      
  } else if (fanControlMode == 2) {
    isFanOn = false;     
  }

  digitalWrite(RELAY_PIN, isFanOn ? HIGH : LOW);

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
        Serial.println("CẢNH BÁO GAS: Tự động hủy lệnh Ép Tắt!");
      }
    } else {
      digitalWrite(BUZZER_PIN, HIGH); 
    }

    bool isLedOn = (t > TEMP_THRESHOLD);
    digitalWrite(LED_PIN, isLedOn ? HIGH : LOW);

    if (t > TEMP_THRESHOLD) {
      isFanOnByTemp = true;                
    } else if (t < (TEMP_THRESHOLD - 1.0)) {
      isFanOnByTemp = false;                
    }

    lcd.setCursor(0, 0);
    lcd.print("G:");
    lcd.print(gasValue);
    lcd.print(" ");
    
    lcd.setCursor(8, 0);
    if (fanControlMode == 0) lcd.print("M:AUTO ");
    else if (fanControlMode == 1) lcd.print("M:OVR_ON");
    else if (fanControlMode == 2) lcd.print("M:OVR_OFF");
    
    lcd.setCursor(14, 0);
    if(isGasAlert) lcd.print("!!");
    else lcd.print("  ");
    
    lcd.setCursor(0, 1);
    lcd.print("T:");
    lcd.print(t, 1);  
    lcd.print("C H:");
    lcd.print(h, 0);  
    lcd.print("%  ");  

    String payload = "{";
    payload += "\"temperature\":"; payload += t; payload += ",";
    payload += "\"humidity\":"; payload += h; payload += ",";
    payload += "\"gas\":"; payload += gasValue; payload += ",";
    payload += "\"led_status\":"; payload += (isLedOn ? "true" : "false"); payload += ",";
    payload += "\"fan_status\":"; payload += (isFanOn ? "true" : "false"); payload += ",";
    payload += "\"fan_mode\":"; payload += fanControlMode; 
    payload += "}";

    Serial.print("Sending payload: ");
    Serial.println(payload);
    
    // ==========================================
    // GỬI DỮ LIỆU LÊN WEB VÀ NHẬN LỆNH ĐIỀU KHIỂN
    // ==========================================
   // if(WiFi.status() == WL_CONNECTED) {
   //   HTTPClient http;
   //   http.begin(serverName);
   //   http.addHeader("Content-Type", "application/json"); // Khai báo gửi dạng JSON

   //   int httpResponseCode = http.POST(payload);

   //   if (httpResponseCode > 0) {
   //     String response = http.getString();
        // Serial.println("Server trả về: " + response);

        // Đọc nội dung website trả về để điều khiển quạt (thay thế RPC của ThingsBoard)
   /*     if (response.indexOf("setFanStatus") != -1) {
          if (response.indexOf("true") != -1) {
            fanControlMode = 1; 
            Serial.println("Lệnh từ Website: ÉP BẬT QUẠT");
          } else if (response.indexOf("false") != -1) {
            fanControlMode = 2; 
            Serial.println("Lệnh từ Website: ÉP TẮT QUẠT");
          }
        }
        else if (response.indexOf("setAutoMode") != -1) {
          fanControlMode = 0; 
          Serial.println("Lệnh từ Website: CHUYỂN VỀ TỰ ĐỘNG");
        }
      } else {
        Serial.print("Lỗi HTTP POST: ");
        Serial.println(httpResponseCode);
      }
      http.end();
    }
    else {
      Serial.println("Mất kết nối WiFi");
    }
    */
    // Gửi thông tin qua ESP-NOW cho mạch Master
    dataToMaster.temperature = t;
    dataToMaster.humidity = h;
    dataToMaster.gas = gasValue;
    dataToMaster.gasAlert = isGasAlert;
    dataToMaster.fanStatus = isFanOn;
    dataToMaster.fanMode = fanControlMode;

    esp_err_t result = esp_now_send(masterAddress, (uint8_t *)&dataToMaster, sizeof(dataToMaster));

    if(result == ESP_OK) {
      Serial.println("ESP-NOW Send OK");
    } else {
      Serial.println("ESP-NOW Send FAIL");
    }

    lastSend = millis();
  }
}
