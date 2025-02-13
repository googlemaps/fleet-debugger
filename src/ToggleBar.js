/*
 * src/ToggleBar.js
 *
 * Row of buttons that configure visualization options on the map
 */
import styled from "styled-components";
import _ from "lodash";
const Button = styled.button``;
const ButtonToggle = styled(Button)`
  opacity: 0.6;
  ${({ active }) =>
    active &&
    `
    opacity: 1;
    color: Green;
  `}
`;

const ButtonGroup = styled.div`
  display: flex;
`;
function ToggleBar(props) {
  const toggleState = props.toggleState;
  const toggles = _.map(props.toggles, (toggle) => {
    return (
      <ButtonToggle key={toggle.id} active={toggleState[toggle.id]} onClick={() => props.clickHandler(toggle.id)}>
        {toggle.name}
        <a href={toggle.docLink} target="_blank" rel="noreferrer">
          ?
        </a>
      </ButtonToggle>
    );
  });
  return <ButtonGroup>{toggles}</ButtonGroup>;
}

export default ToggleBar;
