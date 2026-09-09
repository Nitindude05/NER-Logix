// (A) IMPORTS
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useIsFocused } from "@react-navigation/native";

// (B) COMPONENT - DATA ROW
const Row = (data : {
  id: number,
  date: string,
  lat: number,
  lng: number
}) => {
  return (
    <View><Text>
      ID: {data.id} Date: {data.date} Lat: {data.lat} Lng: {data.lng}
    </Text></View>
  );
};

// (C) COMPONENT - "MAIN ADMIN"
export default function Admin () {
  // (C1) USE STATE
  const [data, setData] = useState([
    {id: 0, date: "INITIALIZING", lat: 0, lng: 0}
  ]);

  // (C2) GET DATA FROM SERVER - CHANGE TO YOUR OWN HOST!
  const tracker = () => {
    fetch("http://192.168.18.66:8888/get")
    .then((res) => res.json())
    .then((res) => {
      console.log(res.data);
      setData(res.data);
    })
    .catch((err) => console.error(err));
  };

  // (C3) RUN ON INTERVAL
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      tracker();
      const interval = setInterval(tracker, 3000);
      return () => clearInterval(interval);
    }
  }, [isFocused]);

  // (C4) LAYOUT
  return (
    <View style={styles.container}>
      {data.map(row => (
        <Row
          key = {row.id}
          id = {row.id}
          date = {row.date}
          lat = {row.lat}
          lng = {row.lng}
        />
      ))}
    </View>
  );
}

// (D) STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    marginTop: 30
  }
});