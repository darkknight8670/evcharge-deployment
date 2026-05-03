from flask import Flask
import paho.mqtt.publish as publish

app = Flask(__name__)

MQTT_BROKER = "10.178.135.24"
MQTT_TOPIC = "battery/control"

@app.route("/")
def home():
    return """
    <h2>Battery Charging Control</h2>
    <a href="/on"><button style="height:50px;width:150px">Charging Start</button></a>
    <a href="/off"><button style="height:50px;width:150px">Charging Stop</button></a>
    """

@app.route("/on")
def turn_on():
    publish.single(MQTT_TOPIC, "ON", hostname=MQTT_BROKER)
    return "<h3>Charging Started</h3><a href='/'>Back</a>"

@app.route("/off")
def turn_off():
    publish.single(MQTT_TOPIC, "OFF", hostname=MQTT_BROKER)
    return "<h3>Charging Stopped</h3><a href='/'>Back</a>"

app.run(host="0.0.0.0", port=5000)
