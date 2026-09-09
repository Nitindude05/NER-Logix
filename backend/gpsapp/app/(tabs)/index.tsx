// (A) IMPORTS
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "expo-location";

// (B) COMPONENT 
export default function Home () {
  // (B1) USE STATE
  const [msg, setMsg] = useState("INITIALIZING");
  const [id, setID] = useState(Math.floor(Math.random() * 100) + 1); // random id from 1 to 100

  // (B2) GET CURRENT GPS LOCATION
  const tracker = async () => {
    // (B2-1) CHECK GPS ENABLED & PERMISSION
    if (!await Location.hasServicesEnabledAsync()) {
      setMsg("Location Services Disabled");
      return;
    }
    let {status} = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setMsg("Please grant location permission");
      return;
    }

    // (B2-2) GET GPS COORDS 
    let {coords} = await Location.getCurrentPositionAsync({});

    // (B2-3) FORM DATA
    let data = new FormData();
    data.append("id", id);
    data.append("lat", coords.latitude);
    data.append("lng", coords.longitude);
    console.log("Sending...", id, data);

    // (B2-4) UPLOAD TO SERVER - CHANGE TO YOUR OWN HOST!
    fetch("http://192.168.18.66:8888/set", {
      method: "POST",
      body: data
    }) 
    .then((res) => res.json())
    .then((res) => {
      console.log(res);
      setMsg(`id : ${id} | date : ${new Date().toLocaleTimeString()} | lat : ${coords.latitude} | lng : ${coords.longitude}`);
    })
    .catch((err) => console.error(err));
  };
  
  // (B3) RUN EVERY 3 SECS
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      tracker();
      const interval = setInterval(tracker, 3000);
      return () => clearInterval(interval);
    }
  }, [isFocused]);

  // (B4) LAYOUT
  return (
    <View style={styles.container}><Text>{msg}</Text></View>
  );
}

// (C) COSMETIC STYLES - NOT IMPORTANT
const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#fff",
    padding: 20, marginTop: 30
  }
});