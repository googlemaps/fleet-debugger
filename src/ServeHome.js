// src/ServeHome.js

import React from "react";

class ServeHome extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      vehicle: "",
      trip: "",
    };

    this.handleVehicleChange = (event) => {
      this.setState({ vehicle: event.target.value });
    };

    this.goVehicle = () => {
      window.location.href = `/debugger?dataFile=/vehicles/${encodeURI(this.state.vehicle)}`;
    };

    this.handleTripChange = (event) => {
      this.setState({ trip: event.target.value });
    };

    this.goTrip = () => {
      window.location.href = `/debugger?dataFile=/trips/${encodeURI(this.state.trip)}`;
    };
  }

  render() {
    return (
      <div>
        <h1>Fleet Debugger Live Mode</h1>
        <div>
          <textarea value={this.state.vehicle} onChange={this.handleVehicleChange} rows={1} cols={64} />
          <button onClick={this.goVehicle}>Debug Vehicle</button>
        </div>
        <div>
          <textarea value={this.state.trip} onChange={this.handleTripChange} rows={1} cols={64} />
          <button onClick={this.goTrip}>Debug Trip</button>
        </div>
      </div>
    );
  }
}

export { ServeHome as default };
